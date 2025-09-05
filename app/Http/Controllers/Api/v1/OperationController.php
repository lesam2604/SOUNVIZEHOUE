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

        // Auto-approbation: si admin -> approuve sans dfbfbit; sinon -> dfbfbit + approbation si solde suffisant
        $approvePayload = ['without_commission' => 'false', 'feedback' => null];
        if ($authUser->hasRole('admin')) {
            [$apprErr, $apprObj] = $this->operationService->approveOperation(
                $this->opType,
                $obj,
                $approvePayload,
                $authUser
            );

            if ($apprErr) {
                // En cas d'erreur d'approbation, on renvoie tout de mfme la crffeation rffussie
                return response()->json([
                    'message' => $this->operationService->renderText(
                        $this->opType,
                        OperationService::STORE_SUCCESS_MESSAGE,
                        $obj
                    )
                ]);
            }

            return response()->json([
                'message' => $this->operationService->renderText(
                    $this->opType,
                    OperationService::APPROVE_SUCCESS_MESSAGE,
                    $obj
                )
            ]);
        } else {
            // Collaborateur: essayer de dfbfbiter et approuver
            $amountToDebit = 0.0;
            if ($this->opType->code === 'account_recharge') {
                $amountToDebit = (float) ($obj->data->trans_amount ?? 0);
            } else {
                $amountToDebit = (float) ($obj->amount ?? 0) + (float) ($obj->fee ?? 0);
            }

            $currentBalance = $this->balanceService->getBalance($authUser->id);

            if ($currentBalance >= $amountToDebit) {
                try {
                    DB::transaction(function () use ($authUser, $amountToDebit, $obj, $approvePayload) {
                        $this->balanceService->debitOrFail(
                            $authUser->id,
                            (int) round($amountToDebit),
                            "Validation opferation OP-{$obj->code} (auto)"
                        );

                        [$apprErr, $apprObj] = $this->operationService->approveOperation(
                            $this->opType,
                            $obj,
                            $approvePayload,
                            $authUser
                        );

                        if ($apprErr) {
                            throw new \RuntimeException($apprErr['message'] ?? 'Erreur approbation');
                        }
                    });

                    return response()->json([
                        'message' => $this->operationService->renderText(
                            $this->opType,
                            OperationService::APPROVE_SUCCESS_MESSAGE,
                            $obj
                        )
                    ]);
                } catch (\RuntimeException $e) {
                    // Si l'approbation ou le dfbfbit fafecfhe, on laisse l'opfration en pending
                }
            }

            return response()->json([
                'message' => $this->operationService->renderText(
                    $this->opType,
                    OperationService::STORE_SUCCESS_MESSAGE,
                    $obj
                )
            ]);
        }
    }

    // Création d'une opération sans partenaire sélectionné (client manuel)
    public function storeWithoutPartner(Request $request, $opTypeCode)
    {
        set_time_limit(0);
        $this->fetchOpType($opTypeCode);

        $authUser = $request->user();

        // Admin, collaborateurs et reviewers autorisés sans restriction supplémentaire
        if (!($authUser->hasRole('admin') || $authUser->hasRole('collab') || $authUser->hasRole('reviewer'))) {
            return response()->json(['message' => OperationService::NOT_ALLOWED_TEXT], 405);
        }

        $data = $request->validate(
            ...$this->operationService->getOperationValidator($this->opType, 'store')
        );

        // Valider les champs client manuel (souples)
        $request->validate([
            'client_full_name' => 'nullable|string|max:191',
            'client_phone'     => 'nullable|string|max:50',
            'client_email'     => 'nullable|email|max:191',
            'requester_name'   => 'nullable|string|max:191',
        ]);

        // Déterminer un partenaire de contexte (master de la société de l'utilisateur)
        $masterUser = User::role('partner-master')
            ->where('company_id', $authUser->company_id)
            ->first();
        if ($masterUser && $masterUser->partner) {
            $partner = $masterUser->partner;
        } else {
            // Fallback: essayer un partenaire de la même entreprise, sinon n'importe quel partenaire
            $partner = Partner::where('company_id', $authUser->company_id)->first() ?: Partner::first();
            if (!$partner) {
                return response()->json(['message' => "Aucun partenaire disponible comme contexte. Veuillez créer un partenaire."], 422);
            }
        }

        [$error, $obj] = $this->operationService->createOperation(
            $partner,
            $this->opType,
            $data
        );

        if ($error) {
            return response()->json($error, 500);
        }

        // Fusionner les informations client manuel dans les données de l'opération
        $payload = [
            'manual_client' => [
                'full_name'     => $request->input('client_full_name', ''),
                'phone'         => $request->input('client_phone', ''),
                'email'         => $request->input('client_email', ''),
                'requester_name'=> $request->input('requester_name', $authUser->full_name ?? ''),
            ],
        ];
        $obj->data = (object) array_merge((array) $obj->data, $payload);
        $obj->save();

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
        if (false && $authUser->hasRole('collab') && $authUser->company_id !== $partner->company_id) {
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

        // Auto-approbation identique f store()
        $approvePayload = ['without_commission' => 'false', 'feedback' => null];
        if ($authUser->hasRole('admin')) {
            [$apprErr, $apprObj] = $this->operationService->approveOperation(
                $this->opType,
                $obj,
                $approvePayload,
                $authUser
            );

            if (!$apprErr) {
                return response()->json([
                    'message' => $this->operationService->renderText(
                        $this->opType,
                        OperationService::APPROVE_SUCCESS_MESSAGE,
                        $obj
                    )
                ]);
            }
        } else {
            // Collaborateur
            $amountToDebit = 0.0;
            if ($this->opType->code === 'account_recharge') {
                $amountToDebit = (float) ($obj->data->trans_amount ?? 0);
            } else {
                $amountToDebit = (float) ($obj->amount ?? 0) + (float) ($obj->fee ?? 0);
            }

            $currentBalance = $this->balanceService->getBalance($authUser->id);
            if ($currentBalance >= $amountToDebit) {
                try {
                    DB::transaction(function () use ($authUser, $amountToDebit, $obj, $approvePayload) {
                        $this->balanceService->debitOrFail(
                            $authUser->id,
                            (int) round($amountToDebit),
                            "Validation opferation OP-{$obj->code} (auto)"
                        );

                        [$apprErr, $apprObj] = $this->operationService->approveOperation(
                            $this->opType,
                            $obj,
                            $approvePayload,
                            $authUser
                        );

                        if ($apprErr) {
                            throw new \RuntimeException($apprErr['message'] ?? 'Erreur approbation');
                        }
                    });

                    return response()->json([
                        'message' => $this->operationService->renderText(
                            $this->opType,
                            OperationService::APPROVE_SUCCESS_MESSAGE,
                            $obj
                        )
                    ]);
                } catch (\RuntimeException $e) {
                    // Laisser en pending
                }
            }
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
        // Pour les recharges de compte, débiter le trans_amount stocké dans data
        if ($this->opType->code === 'account_recharge') {
            $amountToDebit = (float) ($op->data->trans_amount ?? 0);
        } else {
            $amountToDebit = (float) $op->amount + ($withoutCommission ? 0 : (float) $op->fee);
        }

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
