<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Operation;
use App\Models\OperationCancellationRequest;
use App\Services\CollaboratorBalanceService;
use Illuminate\Support\Facades\DB;

class OperationCancellationRequestController extends Controller
{
    /**
     * Un collaborateur envoie une demande d'annulation.
     * POST /api/v1/operations-cancel/request/{operationId}
     */
    public function requestCancellation(Request $request, $operationId)
    {
        $user = $request->user();
        $operation = Operation::findOrFail($operationId);

        // Autorisations souples: collab même société, partenaire propriétaire,
        // reviewers/admins autorisés.
        $isSameCompany = ($operation->company_id === $user->company_id);
        $isPartnerOwner = $user->relationLoaded('partner')
            ? optional($user->partner)->id === $operation->partner_id
            : (method_exists($user, 'partner') ? optional($user->partner)->id === $operation->partner_id : false);
        $isReviewerOrAdmin = $user->hasRole('reviewer') || $user->hasRole('admin');

        if (!($isReviewerOrAdmin || ($user->hasRole('collab') && $isSameCompany) || ($user->hasRole('partner') && $isPartnerOwner))) {
            return response()->json(['message' => "Opération non autorisée pour cet utilisateur."], 403);
        }

        // Seules les opérations approuvées peuvent être annulées
        if ($operation->status !== 'approved') {
            return response()->json(['message' => "Cette opération n'est pas éligible à l'annulation."], 422);
        }

        // Motif facultatif côté front (par compatibilité) mais stocké.
        // Si vide/non fourni, on applique un texte par défaut.
        $data = $request->validate([
            'reason' => ['nullable','string','max:500'],
        ], [
            'reason.string'   => 'Le motif doit être une chaîne de caractères',
            'reason.max'      => 'Le motif ne doit pas dépasser 500 caractères',
        ]);

        $existing = OperationCancellationRequest::where('operation_id', $operation->id)
            ->where('status', 'pending')
            ->exists();
        if ($existing) {
            return response()->json(['message' => "Une demande d'annulation est déjà en attente."], 422);
        }

        $reason = trim($data['reason'] ?? '');
        if ($reason === '') {
            $reason = "Annulation demandée (aucun motif saisi)";
        }

        $ocr = OperationCancellationRequest::create([
            'operation_id' => $operation->id,
            'requested_by' => $user->id,
            'reason'       => $reason,
            'status'       => 'pending',
        ]);

        return response()->json(['message' => "Demande d'annulation envoyée avec succès."]);
    }

    /**
     * Alias compatible avec l'ancien front: POST /api/collab/operations-cancel
     * Body attendu: { operation_id, reason }
     */
    public function requestFromBody(Request $request)
    {
        $payload = $request->validate([
            'operation_id' => ['required','integer','exists:operations,id'],
            'reason' => ['nullable','string','max:500']
        ], [
            'operation_id.required' => "L'identifiant de l'opération est requis",
            'operation_id.integer'  => "L'identifiant de l'opération doit être un entier",
            'operation_id.exists'   => "L'opération spécifiée est introuvable",
            'reason.string'         => 'Le motif doit être une chaîne de caractères',
            'reason.max'            => 'Le motif ne doit pas dépasser 500 caractères',
        ]);
        // proxy vers la méthode principale: normaliser le champ reason
        $request->merge(['reason' => $payload['reason'] ?? null]);
        return $this->requestCancellation($request, $payload['operation_id']);
    }

    /**
     * Approuver une demande d'annulation (admin)
     */
    public function approveCancellation(Request $request, $requestId)
    {
        $req = OperationCancellationRequest::with('operation.partner.user')->findOrFail($requestId);

        if ($req->status !== 'pending') {
            return response()->json(['message' => 'Demande déjà traitée.'], 422);
        }

        DB::transaction(function () use ($req) {
            $operation = $req->operation;
            // Determine refund amount and revert partner balance for account recharges
            $opTypeCode = optional($operation->operationType)->code;
            if ($opTypeCode === 'account_recharge') {
                $amount = (float) ($operation->data->trans_amount ?? 0);
                $master = $operation->partner->getMaster();
                $master->balance -= $amount;
                $master->save();
            } else {
                $amount    = (float) ($operation->amount ?? 0);
            }

            // Créditer le solde du collaborateur qui a demandé
            app(CollaboratorBalanceService::class)
                ->credit($req->requested_by, (int) round($amount), "Annulation de l'opération {$operation->code}");

            // Revenir à l'état pending côté opération
            $operation->status = 'pending';
            $operation->save();

            // Mettre à jour la demande
            $req->status      = 'approved';
            $req->approved_by = auth()->id();
            $req->approved_at = now();
            $req->save();

            // Mettre à jour l'ancienne table si une entrée existe
            if ($legacy = OperationCancelRequest::where('operation_id', $operation->id)->where('status','pending')->first()) {
                $legacy->status   = 'approved';
                $legacy->admin_id = auth()->id();
                $legacy->save();
            }
        });

        return response()->json(['message' => "Demande d'annulation approuvée."]);
    }

    /**
     * Rejeter une demande d'annulation (admin)
     */
    public function rejectCancellation(Request $request, $requestId)
    {
        $req = OperationCancellationRequest::findOrFail($requestId);

        if ($req->status !== 'pending') {
            return response()->json(['message' => 'Demande déjà traitée.'], 422);
        }

        $req->status      = 'rejected';
        $req->approved_by = auth()->id();
        $req->approved_at = now();
        $req->save();

        // Mettre à jour l'ancienne table si une entrée existe
        if ($legacy = OperationCancelRequest::where('operation_id', $req->operation_id)->where('status','pending')->first()) {
            $legacy->status   = 'rejected';
            $legacy->admin_id = auth()->id();
            $legacy->save();
        }

        return response()->json(['message' => "Demande d'annulation rejetée."]);
    }

    /**
     * Liste des demandes (JSON).
     */
    public function listRequests()
    {
        $requests = OperationCancellationRequest::with(['requester','operation'])
            ->orderBy('created_at','desc')
            ->get();

        return response()->json($requests);
    }
}
