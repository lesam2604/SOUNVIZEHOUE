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
        <div class="col-12 col-lg-6 mb-3" id="partnerSelectBlock" style="display:none;">
          <label for="partnerId" class="form-label">Partenaire (optionnel)</label>
          <select id="partnerId" class="form-select" style="width: 100%"></select>
          <div class="form-text">Laissez vide pour créer pour un client manuel.</div>
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
