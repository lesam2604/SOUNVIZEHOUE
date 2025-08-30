@extends('layouts.app')

@section('cssPlugins')
@endsection

@section('pageContent')
  <div class="card">
    <div class="card-header d-flex align-items-center">
      <h4 class="mb-0" id="title"></h4>
      <a class="btn btn-outline-primary ms-auto" href="/inv-deliveries"><i class="fas fa-list"></i> Liste des livraisons de
        produits</a>
    </div>
    <div class="card-body">
      <form id="form" class="row" novalidate>
        <div class="col-12 col-lg-6 mb-3">
          <label for="invOrderId" class="form-label">Commande</label>
          <select id="invOrderId" class="form-select"></select>
          <div class="invalid-feedback"></div>
        </div>

        @include('partials.product-adding')

        <div class="text-center">
          <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Sauvegarder</button>
        </div>
      </form>
    </div>
  </div>

  <input type="hidden" value="{{ $objectId ?? '' }}" id="objectId">
@endsection

@section('pageJs')
  @vite(['resources/js/partials/product-adding.js', 'resources/js/inv-deliveries/create.js'])
@endsection
