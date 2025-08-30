<?php

// app/Http/Controllers/Collab/CollabOperationCancelController.php
namespace App\Http\Controllers\Collab;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\OperationCancelRequest;
use Illuminate\Support\Facades\Auth;

class CollabOperationCancelController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'operation_id' => 'required|exists:operations,id',
            'reason'       => 'nullable|string|max:255'
        ]);

        $user = Auth::user();

        $cancelRequest = OperationCancelRequest::create([
            'operation_id' => $request->operation_id,
            'collab_id'    => $user->id,
            'status'       => 'pending',
            'amount'       => $request->amount ?? 0,
            'partner_id'   => $request->partner_id ?? null,
            'reason'       => $request->reason,
        ]);

        return response()->json([
            'ok'      => true,
            'message' => 'Demande d’annulation envoyée avec succès.',
            'request' => $cancelRequest
        ]);
    }
}
