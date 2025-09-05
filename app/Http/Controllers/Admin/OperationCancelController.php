<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\OperationCancellationRequest;
use App\Models\CollaboratorBalance;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class OperationCancelController extends Controller
{
    public function index()
    {
        $requests = OperationCancellationRequest::with([
                'requester',
                'operation.partner.user',
                'operation.operationType',
            ])
            ->orderBy('created_at','desc')
            ->get();

        return view('admin.operations-cancel.index', compact('requests'));
    }

    public function list()
    {
        $requests = OperationCancellationRequest::with([
                'requester',
                'operation.partner.user',
                'operation.operationType',
            ])
            ->orderBy('created_at','desc')
            ->get();

        return response()->json(['ok'=>true,'requests'=>$requests]);
    }

    public function approve($id)
    {
        $req = OperationCancellationRequest::with('operation.partner.user')->findOrFail($id);

        if ($req->status !== 'pending') {
            return response()->json(['ok'=>false,'message'=>'Demande déjà traitée.']);
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

            $collabBal = CollaboratorBalance::firstOrCreate(
                ['user_id' => $req->requested_by],
                ['balance' => 0, 'currency' => 'FCFA', 'updated_by' => Auth::id()]
            );
            $collabBal->balance += $amount;
            $collabBal->updated_by = Auth::id();
            $collabBal->save();

            $operation->status = 'pending';
            $operation->save();

            $req->status      = 'approved';
            $req->approved_by = Auth::id();
            $req->approved_at = now();
            $req->save();
        });

        return response()->json(['ok'=>true,'message'=>'Demande approuvée.']);
    }

    public function reject($id)
    {
        $req = OperationCancellationRequest::findOrFail($id);

        if ($req->status !== 'pending') {
            return response()->json(['ok'=>false,'message'=>'Demande déjà traitée.']);
        }

        $req->status      = 'rejected';
        $req->approved_by = Auth::id();
        $req->approved_at = now();
        $req->save();

        return response()->json(['ok'=>true,'message'=>'Demande rejetée.']);
    }
}
