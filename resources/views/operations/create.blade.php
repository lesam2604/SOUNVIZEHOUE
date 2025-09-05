@extends('layouts.app')

@section('cssPlugins')
@endsection

@section('pageContent')
  <div class="card mb-3">
    <div class="card-header d-flex align-items-center">
      <h4 class="mb-0" id="title"></h4>
      <a class="btn btn-outline-primary ms-auto" href="" id="linkList"></a>
    </div>
    <div class="card-body">
      <form id="form" class="row" novalidate>
        <div class="col-12 col-lg-6 mb-3">
          <label for="clientType" class="form-label">Type de client</label>
          <select id="clientType" class="form-select">
            <option value="partner" selected>Partenaire</option>
            <option value="extra_client">Client (manuel)</option>
          </select>
        </div>
        <div class="col-12 col-lg-6 mb-3" id="partnerSelectBlock">
          <label for="partnerId" class="form-label">Partenaire (optionnel)</label>
          <select id="partnerId" class="form-select" style="width: 100%"></select>
          <div class="form-text">Laissez vide pour créer pour un client manuel.</div>
        </div>
        <div id="manualClientBlock" class="col-12 mt-2" style="display:none;">
          <div class="alert alert-info">
            Aucun partenaire sélectionné. Vous pouvez renseigner les informations du client.
          </div>
          <div class="row">
            <div class="col-12 col-lg-6 mb-3">
              <label for="client_full_name" class="form-label">Nom complet du client</label>
              <input type="text" class="form-control" id="client_full_name" placeholder="Nom complet">
              <div class="invalid-feedback"></div>
            </div>
            <div class="col-12 col-lg-6 mb-3">
              <label for="client_phone" class="form-label">Téléphone du client</label>
              <input type="tel" class="form-control" id="client_phone" placeholder="Ex: 97000000">
              <div class="invalid-feedback"></div>
            </div>
            <div class="col-12 col-lg-6 mb-3">
              <label for="client_email" class="form-label">Email du client (optionnel)</label>
              <input type="email" class="form-control" id="client_email" placeholder="client@example.com">
              <div class="invalid-feedback"></div>
            </div>
            <div class="col-12 col-lg-6 mb-3">
              <label for="requester_name" class="form-label">Nom du demandeur (collaborateur/admin)</label>
              <input type="text" class="form-control" id="requester_name" placeholder="Votre nom">
              <div class="invalid-feedback"></div>
            </div>
          </div>
        </div>
        <div class="text-center" id="blockSubmit">
          <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Sauvegarder</button>
        </div>
      </form>
    </div>
  </div>
  </div>

  <div class="card" id="blockCommissions">
    <div class="card-header d-flex align-items-center">
      <h4 class="mb-0">Commissions</h4>
    </div>
    <div class="card-body">
      <table class="table table-bordered">
        <tbody>
          <tr>
            <th>Montant de l'opération</th>
            <td id="opAmount" class="fw-bold"></td>
          </tr>
          <tr>
            <th>Frais de course</th>
            <td id="opFee" class="fw-bold"></td>
          </tr>
          <tr>
            <th>Montant total a payer</th>
            <td id="opTotalAmount" class="fw-bold text-danger"></td>
          </tr>
          <tr>
            <th>Commission</th>
            <td id="opCommission" class="fw-bold"></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <input type="hidden" value="{{ $opTypeCode }}" id="opTypeCode">
  <input type="hidden" value="{{ $objectId ?? '' }}" id="objectId">
@endsection

@section('pageJs')
  @vite('resources/js/operations/create.js')
@endsection
