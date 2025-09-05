<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\OperationType;
use App\Models\Partner;
use Illuminate\Http\Request;
use App\Models\User;
use Dompdf\Dompdf;
use Dompdf\Options;

class InvoiceController extends Controller
{
    protected function nextCode(): string
    {
        $lastId = (int) (Invoice::max('id') ?? 0) + 1;
        return 'INV-' . str_pad((string) $lastId, 6, '0', STR_PAD_LEFT);
    }

    public function fetch(Request $request, $id)
    {
        $inv = Invoice::with('partner.user', 'operationType')->findOrFail($id);
        // Ajouter l'émetteur (utilisateur qui a créé la facture)
        $issuer = $inv->created_by ? \App\Models\User::find($inv->created_by) : null;
        $arr = $inv->toArray();
        $arr['issuer'] = $issuer ? [
            'id' => $issuer->id,
            'first_name' => $issuer->first_name,
            'last_name' => $issuer->last_name,
            'email' => $issuer->email,
        ] : null;
        return response()->json($arr);
    }

    public function list(Request $request)
    {
        $q = Invoice::query()->with('partner.user', 'operationType');
        if ($status = $request->input('status')) {
            $q->where('status', $status);
        }
        if ($opType = $request->input('operation_type_id')) {
            $q->where('operation_type_id', $opType);
        }
        return response()->json($q->orderByDesc('id')->paginate($request->input('length', 10)));
    }

    public function store(Request $request, $opTypeCode)
    {
        $opType = OperationType::where('code', $opTypeCode)->firstOrFail();

        $payload = $request->validate([
            'client_type'   => 'required|in:partner,external',
            'partner_id'    => 'nullable|exists:partners,id',
            'client_name'   => 'nullable|string|max:191',
            'client_phone'  => 'nullable|string|max:50',
            'client_email'  => 'nullable|email|max:191',
            'items'         => 'nullable|array',
            'items.*.label' => 'required_with:items|string|max:191',
            'items.*.qty'   => 'required_with:items|numeric|min:1',
            'items.*.unit'  => 'required_with:items|numeric|min:0',
            'amount'        => 'nullable|numeric|min:0',
            'currency'      => 'nullable|string|max:8',
        ]);

        $clientType = $payload['client_type'];
        $partner = null;
        $clientName = $payload['client_name'] ?? null;
        $clientPhone = $payload['client_phone'] ?? null;
        $clientEmail = $payload['client_email'] ?? null;

        if ($clientType === 'partner') {
            $partner = Partner::with('user')->findOrFail($payload['partner_id'] ?? 0);
            $clientName = trim(($partner->user->first_name ?? '') . ' ' . ($partner->user->last_name ?? ''));
            $clientPhone = $partner->user->phone_number ?? $clientPhone;
            $clientEmail = $partner->user->email ?? $clientEmail;
        }

        // Compute total from items or amount
        $total = 0;
        if (!empty($payload['items'])) {
            foreach ($payload['items'] as $it) {
                $total += (int) round(($it['qty'] ?? 0) * ($it['unit'] ?? 0));
            }
        } else {
            $total = (int) round($payload['amount'] ?? 0);
        }

        $inv = Invoice::create([
            'code'               => $this->nextCode(),
            'operation_type_id'  => $opType->id,
            'client_type'        => $clientType,
            'partner_id'         => $partner?->id,
            'client_name'        => $clientName,
            'client_phone'       => $clientPhone,
            'client_email'       => $clientEmail,
            'items'              => $payload['items'] ?? null,
            'total_amount'       => $total,
            'currency'           => $payload['currency'] ?? 'FCFA',
            'status'             => 'unpaid',
            'created_by'         => $request->user()->id,
            'updated_by'         => $request->user()->id,
        ]);

        return response()->json(['message' => 'Facture créée', 'invoice' => $inv]);
    }

    public function update(Request $request, $id)
    {
        $inv = Invoice::findOrFail($id);
        if ($inv->status === 'paid') {
            return response()->json(['message' => 'Impossible de modifier une facture payée'], 422);
        }

        $payload = $request->validate([
            'client_name'   => 'nullable|string|max:191',
            'client_phone'  => 'nullable|string|max:50',
            'client_email'  => 'nullable|email|max:191',
            'items'         => 'nullable|array',
            'items.*.label' => 'required_with:items|string|max:191',
            'items.*.qty'   => 'required_with:items|numeric|min:1',
            'items.*.unit'  => 'required_with:items|numeric|min:0',
            'amount'        => 'nullable|numeric|min:0',
            'currency'      => 'nullable|string|max:8',
        ]);

        // Recompute total
        $total = $inv->total_amount;
        if (!empty($payload['items'])) {
            $total = 0;
            foreach ($payload['items'] as $it) {
                $total += (int) round(($it['qty'] ?? 0) * ($it['unit'] ?? 0));
            }
        } elseif (array_key_exists('amount', $payload)) {
            $total = (int) round($payload['amount'] ?? 0);
        }

        $inv->fill([
            'client_name'  => $payload['client_name'] ?? $inv->client_name,
            'client_phone' => $payload['client_phone'] ?? $inv->client_phone,
            'client_email' => $payload['client_email'] ?? $inv->client_email,
            'items'        => $payload['items'] ?? $inv->items,
            'total_amount' => $total,
            'currency'     => $payload['currency'] ?? $inv->currency,
            'updated_by'   => $request->user()->id,
        ])->save();

        return response()->json(['message' => 'Facture mise à jour', 'invoice' => $inv]);
    }

    public function markPaid(Request $request, $id)
    {
        $inv = Invoice::findOrFail($id);
        if ($inv->status === 'paid') {
            return response()->json(['message' => 'Déjà payée'], 422);
        }
        $inv->status = 'paid';
        $inv->updated_by = $request->user()->id;
        $inv->save();
        return response()->json(['message' => 'Facture validée (payée)', 'invoice' => $inv]);
    }

    public function exportCsv(Request $request, $id)
    {
        $inv = Invoice::with('partner.user', 'operationType')->findOrFail($id);
        $issuer = $inv->created_by ? optional(User::find($inv->created_by)) : null;
        $rows = [];
        $rows[] = ['Entreprise', 'AHOTANTI'];
        $rows[] = ['Code', $inv->code];
        $rows[] = ["Type d'opération", optional($inv->operationType)->name];
        $client = $inv->client_type === 'partner'
            ? trim(($inv->partner->user->first_name ?? '') . ' ' . ($inv->partner->user->last_name ?? ''))
            : ($inv->client_name ?? '');
        $rows[] = ['Client', $client];
        $rows[] = ['Téléphone', $inv->client_phone ?? optional($inv->partner->user)->phone_number];
        $rows[] = ['Email', $inv->client_email ?? optional($inv->partner->user)->email];
        $rows[] = ['Émis par', trim(($issuer->first_name ?? '') . ' ' . ($issuer->last_name ?? ''))];
        $rows[] = [];
        $rows[] = ['Désignation', 'Qté', 'PU', 'Total'];
        foreach (($inv->items ?? []) as $it) {
            $rows[] = [
                $it['label'] ?? '',
                $it['qty'] ?? 0,
                $it['unit'] ?? 0,
                (int) round(($it['qty'] ?? 0) * ($it['unit'] ?? 0))
            ];
        }
        $rows[] = [];
        $rows[] = ['Montant total', $inv->total_amount, $inv->currency];

        $out = fopen('php://temp', 'r+');
        foreach ($rows as $r) fputcsv($out, $r, ';');
        rewind($out);
        $csv = stream_get_contents($out);
        fclose($out);

        $filename = $inv->code . '.csv';
        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\""
        ]);
    }

    public function exportPdf(Request $request, $id)
    {
        $inv = Invoice::with('partner.user', 'operationType')->findOrFail($id);
        $issuer = $inv->created_by ? optional(User::find($inv->created_by)) : null;
        $client = $inv->client_type === 'partner'
            ? trim(($inv->partner->user->first_name ?? '') . ' ' . ($inv->partner->user->last_name ?? ''))
            : ($inv->client_name ?? '');
        $itemsRows = '';
        foreach (($inv->items ?? []) as $it) {
            $rowTotal = (int) round(($it['qty'] ?? 0) * ($it['unit'] ?? 0));
            $itemsRows .= '<tr><td>'.e($it['label'] ?? '').'</td><td>'.($it['qty'] ?? 0).'</td><td>'.($it['unit'] ?? 0).'</td><td>'.$rowTotal.'</td></tr>';
        }
        if ($itemsRows === '') {
            $itemsRows = '<tr><td colspan="4" style="text-align:center">Aucune ligne</td></tr>';
        }

        $html = '<html><head><meta charset="UTF-8"><style>table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:6px} h2{margin:0 0 8px 0}</style></head><body>';
        $html .= '<h2>AHOTANTI</h2>';
        $html .= '<p><strong>Facture:</strong> '.e($inv->code).'</p>';
        $html .= '<p><strong>Type d\'opération:</strong> '.e(optional($inv->operationType)->name).'<br>';
        $html .= '<strong>Client:</strong> '.e($client).'<br>';
        $html .= '<strong>Téléphone:</strong> '.e($inv->client_phone ?? optional($inv->partner->user)->phone_number).'<br>';
        $html .= '<strong>Email:</strong> '.e($inv->client_email ?? optional($inv->partner->user)->email).'<br>';
        $html .= '<strong>Émis par:</strong> '.e(trim(($issuer->first_name ?? '') . ' ' . ($issuer->last_name ?? ''))).'</p>';
        $html .= '<table><thead><tr><th>Désignation</th><th>Qté</th><th>PU</th><th>Total</th></tr></thead><tbody>'.$itemsRows.'</tbody></table>';
        $html .= '<p style="text-align:right"><strong>Montant:</strong> '.$inv->total_amount.' '.$inv->currency.'</p>';
        $html .= '</body></html>';

        $options = new Options();
        $options->set('isRemoteEnabled', true);
        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();
        return response($dompdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$inv->code.'.pdf"'
        ]);
    }
}
