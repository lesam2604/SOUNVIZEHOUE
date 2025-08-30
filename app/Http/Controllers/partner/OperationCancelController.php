<?php

namespace App\Http\Controllers\Partner;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

use App\Models\Operation;
use App\Models\Partner;
use App\Models\Notification;
use App\Models\History;
use Carbon\Carbon;

class OperationCancelController extends Controller
{
    /**
     * Crée une demande d’annulation pour une opération "approved" du partenaire connecté.
     * Effets :
     *  - Marque l'opération via JSON data: cancel_requested_at, cancel_reason, cancel_requested_by
     *  - Crée une Notification pour l’admin
     *  - Ajoute un History (trace utilisateur)
     */
    public function store(Request $request)
    {
        $request->validate([
            'operation_id' => ['required','integer','min:1'],
            'reason'       => ['nullable','string','max:500'],
        ]);

        $user = Auth::user();
        if (!$user) {
            return response()->json(['message' => 'Non authentifié.'], 401);
        }

        $partner = Partner::where('user_id', $user->id)->first();
        if (!$partner) {
            return response()->json(['message' => 'Aucun compte partenaire rattaché.'], 403);
        }

        $operation = Operation::where('id', $request->operation_id)
            ->where('partner_id', $partner->id)
            ->first();

        if (!$operation) {
            return response()->json(['message' => 'Opération introuvable.'], 404);
        }

        if ($operation->status !== 'approved') {
            return response()->json(['message' => 'Seules les opérations validées peuvent être annulées.'], 422);
        }

        // Empêcher les doublons
        $data = $operation->data ?? [];
        $already = data_get($data, 'cancel_requested_at');
        if ($already) {
            return response()->json(['message' => 'Une demande d’annulation est déjà en cours pour cette opération.'], 409);
        }

        try {
            DB::transaction(function () use ($request, $operation, $partner, $user) {
                $now = Carbon::now();

                // Marqueurs JSON
                $data = $operation->data ?? [];
                $data['cancel_requested_at']  = $now->toDateTimeString();
                $data['cancel_requested_by']  = $partner->id;
                if ($request->filled('reason')) {
                    $data['cancel_reason'] = trim($request->reason);
                }

                $operation->data = $data;
                $operation->save();

                // Notification admin (ici, on notifie l’admin principal id=1 ; adapte au besoin)
                $link = url('/admin/operations-cancel');
                Notification::create([
                    'recipient_id' => 1,
                    'subject'      => "Demande d'annulation de l'opération {$operation->code}",
                    'body'         => "Le partenaire #{$partner->id} a demandé l'annulation de l'opération {$operation->code}.",
                    'icon_class'   => 'fas fa-exclamation-circle',
                    'link'         => $link,
                    'created_at'   => $now,
                    'updated_at'   => $now,
                ]);

                // Historique utilisateur
                History::create([
                    'user_id'    => $user->id,
                    'title'      => "Demande d'annulation envoyée pour {$operation->code}",
                    'content'    => "Vous avez demandé l'annulation de l'opération {$operation->code}".($request->reason ? " (motif: ".trim($request->reason).")" : "").".",
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            });
        } catch (\Throwable $e) {
            Log::error('Cancel request error', ['op' => $operation->id, 'err' => $e->getMessage()]);
            return response()->json(['message' => 'Erreur lors de la demande.'], 500);
        }

        return response()->json(['message' => 'Demande d’annulation envoyée à l’administration.']);
    }
}
