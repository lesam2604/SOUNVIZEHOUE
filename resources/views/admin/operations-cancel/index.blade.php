@extends('layouts.app')

@section('pageContent')
<div class="container mt-4">
    <h2>Gestion des demandes d'annulation d'opérations</h2>
    <div class="card mt-3">
        <div class="card-body">
            @if($requests->isEmpty())
                <p>Aucune demande d'annulation pour le moment.</p>
            @else
                <table class="table table-bordered table-hover">
                    <thead class="table-light">
                        <tr>
                            <th>ID</th>
                            <th>Demandée par</th>
                            <th>Partenaire</th>
                            <th>Opération</th>
                            <th>Montant</th>
                            <th>Date</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach($requests as $req)
                        <tr id="request-{{ $req->id }}">
                            <td>{{ $req->id }}</td>
                            <td>{{ optional($req->requester)->first_name }} {{ optional($req->requester)->last_name }}</td>
                            <td>{{ optional(optional($req->operation->partner)->user)->first_name }} {{ optional(optional($req->operation->partner)->user)->last_name }}</td>
                            <td>{{ optional($req->operation->operationType)->name }} ({{ $req->operation->code }})</td>
                            <td>{{ number_format($req->operation->amount ?? 0, 0, ',', ' ') }} FCFA</td>
                            <td>{{ $req->created_at->format('d/m/Y H:i') }}</td>
                            <td>
                                @if($req->status === 'pending')
                                    <span class="badge bg-warning text-dark">En attente</span>
                                @elseif($req->status === 'approved')
                                    <span class="badge bg-success">Approuvée</span>
                                @else
                                    <span class="badge bg-danger">Rejetée</span>
                                @endif
                            </td>
                            <td>
                                @if($req->status === 'pending')
                                    <button class="btn btn-sm btn-success approve-btn" data-id="{{ $req->id }}">Approuver</button>
                                    <button class="btn btn-sm btn-danger reject-btn" data-id="{{ $req->id }}">Rejeter</button>
                                @else
                                    <span>-</span>
                                @endif
                            </td>
                        </tr>
                        @endforeach
                    </tbody>
                </table>
            @endif
        </div>
    </div>
</div>
@endsection

@section('jsPlugins')
<script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/toastify-js"></script>
<script>
function showToast(message, type = 'info') {
    const colors = { info: '#435ebe', success: '#4fbe87', error: '#ef5350' };
    Toastify({
        text: message,
        duration: 4000,
        close: true,
        gravity: 'top',
        position: 'right',
        backgroundColor: colors[type] || colors.info
    }).showToast();
}

// Approuver
document.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        axios.post(`/admin/operations-cancel/approve/${id}`)
            .then(response => {
                if (response.data.ok) {
                    showToast(response.data.message, 'success');
                    document.querySelector(`#request-${id} td:nth-child(7) span`).className = 'badge bg-success';
                    document.querySelector(`#request-${id} td:nth-child(7) span`).innerText = 'Approuvée';
                    document.querySelector(`#request-${id} td:nth-child(8)`).innerHTML = '-';
                } else {
                    showToast(response.data.message, 'error');
                }
            })
            .catch(() => showToast('Erreur serveur', 'error'));
    });
});

// Rejeter
document.querySelectorAll('.reject-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        axios.post(`/admin/operations-cancel/reject/${id}`)
            .then(response => {
                if (response.data.ok) {
                    showToast(response.data.message, 'success');
                    document.querySelector(`#request-${id} td:nth-child(7) span`).className = 'badge bg-danger';
                    document.querySelector(`#request-${id} td:nth-child(7) span`).innerText = 'Rejetée';
                    document.querySelector(`#request-${id} td:nth-child(8)`).innerHTML = '-';
                } else {
                    showToast(response.data.message, 'error');
                }
            })
            .catch(() => showToast('Erreur serveur', 'error'));
    });
});
</script>
@endsection
