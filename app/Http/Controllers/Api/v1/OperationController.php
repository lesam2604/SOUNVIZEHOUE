<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Models\Operation;
use App\Models\OperationType;
use App\Services\CardActivationService;
use App\Services\OperationService;
use App\Services\CollaboratorBalanceService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use Illuminate\Support\Facades\Log;
use App\Models\User;
use App\Models\Partner;


class OperationController extends Controller
{
    protected $opType;
    protected $operationService;
    protected $cardActivationService;
    protected $balanceService;

    public function __construct()
    {
        $this->operationService = app(OperationService::class);
        $this->cardActivationService = app(CardActivationService::class);
        $this->balanceService = app(CollaboratorBalanceService::class);
    }

    protected function fetchOpType($opTypeCode)
    {
        $this->opType = OperationType::where('code', $opTypeCode)->firstOrFail();
    }

    protected function fetchOp($opId)
    {
        return Operation::with('partner.user')->where([
            'operation_type_id' => $this->opType->id,
            'id' => $opId
        ])->firstOrFail();
    }

    public function fetch(Request $request, $opTypeCode, $id)
    {
        $this->fetchOpType($opTypeCode);

        [$error, $obj] = $this->operationService
            ->getOperation($this->opType, $id, $request->user());

        if ($error) {
            return response()->json($error, 500);
        }

        return response()->json($obj);
    }

    public function store(Request $request, $opTypeCode)
    {
        set_time_limit(0);
        $this->fetchOpType($opTypeCode);

        $authUser = $request->user();

        if ($authUser->hasRole('partner-pos') && in_array($this->opType->code, ['balance_withdrawal'])) {
            return response()->json(['message' => OperationService::NOT_ALLOWED_TEXT], 405);
        }

        $data = $request->validate(
            ...$this->operationService->getOperationValidator($this->opType, 'store')
        );

        // Déterminer le partenaire de contexte
        if ($authUser->hasRole('partner')) {
            $partner = $authUser->partner; // partner-master/partner-pos
        } else {
            $masterUser = User::role('partner-master')
                ->where('company_id', $authUser->company_id)
                ->first();
            if (!$masterUser || !$masterUser->partner) {
                return response()->json(['message' => "Aucun partenaire maître trouvé pour votre entreprise."], 422);
            }
            $partner = $masterUser->partner;
        }

        [$error, $obj] = $this->operationService->createOperation(
            $partner,
            $this->opType,
            $data
        );

        if ($error) {
            return response()->json($error, 500);
        }

        return response()->json([
            'message' => $this->operationService->renderText(
                $this->opType,
                OperationService::STORE_SUCCESS_MESSAGE,
                $obj
            )
        ]);
    }

    // Création d'une opération pour un partenaire ciblé (collab/reviewer/admin)
    public function storeForPartner(Request $request, $opTypeCode, $partnerId)
    {
        set_time_limit(0);
        $this->fetchOpType($opTypeCode);

        $authUser = $request->user();
        $partner = \App\Models\Partner::with('user')->findOrFail($partnerId);

        // Interdire aux partenaires POS d'utiliser ce flux
        if ($authUser->hasRole('partner')) {
            return response()->json(['message' => OperationService::NOT_ALLOWED_TEXT], 405);
        }

        // Si collab, s'assurer même entreprise
        if ($authUser->hasRole('collab') && $authUser->company_id !== $partner->company_id) {
            return response()->json(['message' => OperationService::NOT_ALLOWED_TEXT], 405);
        }

        $data = $request->validate(
            ...$this->operationService->getOperationValidator($this->opType, 'store')
        );

        [$error, $obj] = $this->operationService->createOperation(
            $partner,
            $this->opType,
            $data
        );

        if ($error) {
            return response()->json($error, 500);
        }

        return response()->json([
            'message' => $this->operationService->renderText(
                $this->opType,
                OperationService::STORE_SUCCESS_MESSAGE,
                $obj
            )
        ]);
    }

    public function update(Request $request, $opTypeCode, $id)
    {
        set_time_limit(0);
        $this->fetchOpType($opTypeCode);

        $authUser = $request->user();

        if ($authUser->hasRole('partner-pos') && in_array($this->opType->code, ['balance_withdrawal'])) {
            return response()->json(['message' => OperationService::NOT_ALLOWED_TEXT], 405);
        }

        $obj = $this->fetchOp($id);
        $partner = $authUser->partner;

        if ($partner->id !== $obj->partner_id || $obj->status !== 'rejected') {
            return response()->json(['message' => OperationService::NOT_ALLOWED_TEXT], 405);
        }

        $data = $request->validate(
            ...$this->operationService->getOperationValidator($this->opType, 'update')
        );

        [$error, $obj] = $this->operationService->updateOperation(
            $partner,
            $this->opType,
            $obj,
            $data
        );

        if ($error) {
            return response()->json($error, 500);
        }

        return response()->json([
            'message' => $this->operationService->renderText(
                $this->opType,
                OperationService::UPDATE_SUCCESS_MESSAGE,
                $obj
            )
        ]);
    }

    // --- APPROVE corrigée: débit si NON admin, bypass si admin ---
    public function approve(Request $request, $opTypeCode, $id)
    {
        $this->fetchOpType($opTypeCode);
        $op = $this->fetchOp($id);

        if ($op->status !== 'pending') {
            return response()->json(['message' => OperationService::NOT_ALLOWED_TEXT], 405);
        }

        $data = $request->validate([
            'feedback' => 'nullable|string|max:1000',
            'without_commission' => 'required|string|in:true,false'
        ]);

        $user = $request->user();

        // Si ADMIN -> validation directe sans contrôle/débit de solde
        if ($user->hasRole('admin')) {
            [$error, $obj] = $this->operationService->approveOperation(
                $this->opType,
                $op,
                $data,
                $user
            );

            if ($error) {
                return response()->json(['message' => $error['message'] ?? 'Erreur lors de l’approbation.'], 422);
            }

            Log::info("Validation OP-{$op->code} effectuée par admin user_id {$user->id}");

            return response()->json([
                'message' => $this->operationService->renderText(
                    $this->opType,
                    OperationService::APPROVE_SUCCESS_MESSAGE,
                    $op
                )
            ]);
        }

        // Sinon (tout autre rôle) -> logique collaborateur : contrôle + débit
        $withoutCommission = $data['without_commission'] === 'true';
        $amountToDebit = (float) $op->amount + ($withoutCommission ? 0 : (float) $op->fee);

        $currentBalance = $this->balanceService->getBalance($user->id);

        Log::info("Validation OP-{$op->code} par user_id {$user->id} (non admin) : montant={$op->amount}, fee={$op->fee}, withoutCommission={$withoutCommission}, amountToDebit={$amountToDebit}, currentBalance={$currentBalance}");

        if ($currentBalance < $amountToDebit) {
            Log::warning("Solde insuffisant pour OP-{$op->code} par user_id {$user->id} : currentBalance={$currentBalance}, amountToDebit={$amountToDebit}");
            return response()->json(['message' => 'Solde insuffisant pour cette opération.'], 422);
        }

        try {
            DB::transaction(function () use ($user, $amountToDebit, $op, $data) {
                // Débit du collaborateur qui valide
                $this->balanceService->debitOrFail(
                    $user->id,
                    (int) round($amountToDebit), // cast int si storage en int
                    "Validation opération OP-{$op->code}"
                );

                // Puis approbation de l’opération
                [$error, $obj] = $this->operationService->approveOperation(
                    $this->opType,
                    $op,
                    $data,
                    $user
                );

                if ($error) {
                    throw new \RuntimeException($error['message'] ?? 'Erreur lors de l’approbation.');
                }

                Log::info("OP-{$op->code} : Débit de {$amountToDebit} appliqué sur user_id {$user->id} puis approbation ok.");
            });
        } catch (\RuntimeException $e) {
            Log::error("Erreur transaction OP-{$op->code} : {$e->getMessage()}");
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => $this->operationService->renderText(
                $this->opType,
                OperationService::APPROVE_SUCCESS_MESSAGE,
                $op
            )
        ]);
    }

    public function reject(Request $request, $opTypeCode, $id)
    {
        $this->fetchOpType($opTypeCode);
        $obj = $this->fetchOp($id);

        if ($obj->status !== 'pending') {
            return response()->json(['message' => OperationService::NOT_ALLOWED_TEXT], 405);
        }

        $data = $request->validate([
            'feedback' => 'nullable|string|max:1000',
        ]);

        [$error, $obj] = $this->operationService->rejectOperation(
            $this->opType,
            $obj,
            $data,
            $request->user()
        );

        if ($error) {
            return response()->json($error, 500);
        }

        return response()->json([
            'message' => $this->operationService->renderText(
                $this->opType,
                OperationService::REJECT_SUCCESS_MESSAGE,
                $obj
            )
        ]);
    }

    public function destroy(Request $request, $opTypeCode, $id)
    {
        $this->fetchOpType($opTypeCode);
        $authUser = $request->user();

        if ($authUser->hasRole('partner-pos') && in_array($this->opType->code, ['balance_withdrawal'])) {
            return response()->json(['message' => OperationService::NOT_ALLOWED_TEXT], 405);
        }

        $obj = $this->fetchOp($id);
        $partner = $authUser->partner;

        if ($partner->id !== $obj->partner_id || $obj->status !== 'pending') {
            return response()->json(['message' => OperationService::NOT_ALLOWED_TEXT], 405);
        }

        [$error, $success] = $this->operationService->deleteOperation(
            $partner,
            $this->opType,
            $obj,
        );

        if ($error) {
            return response()->json($error, 500);
        }

        return response()->json([
            'message' => $this->operationService->renderText(
                $this->opType,
                OperationService::DELETE_SUCCESS_MESSAGE,
                $obj
            )
        ]);
    }

    protected function validateListRequest($request)
    {
        $request->validate([
            'status' => 'nullable|string|in:pending,approved,rejected',
            'partner_id' => 'nullable|numeric|exists:partners,id',
            'from_date' => 'nullable|date',
            'to_date' => 'nullable|date',
            'card_type' => 'nullable|string',
            'uba_type' => 'nullable|string'
        ]);

        if ($request->to_date) {
            $request->merge(['to_date' => Carbon::parse($request->to_date)->addDay()->format('Y-m-d')]);
        }
    }

    public function list(Request $request, $opTypeCode)
    {
        $this->fetchOpType($opTypeCode);
        $this->validateListRequest($request);

        // ✅ Préparer les paramètres DataTables (avec 'columns' obligatoire pour DatatableService)
        $dtParams = [
            'draw'   => $request->input('draw', 1),
            'start'  => $request->input('start', 0),
            'length' => $request->input('length', 10),
            'order'  => $request->input('order', []),
            'search' => $request->input('search', []),

            // Fallback si le front n'envoie pas 'columns'
            'columns' => $request->input('columns', [
                ['data' => 'id'],
                ['data' => 'code'],
                ['data' => 'amount'],
                ['data' => 'currency'],
                ['data' => 'status'],
                ['data' => 'created_at'],
            ]),
        ];

        $ops = $this->operationService->getListOperations(
            $this->opType,
            $request->all(),
            $request->user(),
            $dtParams
        );

        return response()->json($ops);
    }
}
