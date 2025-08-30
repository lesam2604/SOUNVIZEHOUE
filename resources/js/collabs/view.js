/* resources/js/collabs/views.js */

let object = null;

async function fetchObject() {
  const objectId = $('#objectId').val();
  if (!objectId) return;

  try {
    const { data } = await ajax({
      url: `${API_BASEURL}/collabs/fetch/${objectId}`,
      type: 'GET',
    });
    object = data;
  } catch ({ error }) {
    await Swal.fire(error.responseJSON?.message || 'Erreur lors de la récupération', '', 'error');
    location = '/collabs';
  }
}

function displayObject() {
  $('#code').html(object.code);
  $('#firstName').html(object.first_name);
  $('#lastName').html(object.last_name);
  $('#phoneNumber').html(object.phone_number);
  $('#email').html(object.email);
  $('#picture').html(`<img src="${getUploadUrl(object.picture)}" width="360">`);
  $('#status').html(
    object.status === 'enabled'
      ? `<span class="badge rounded-pill bg-success">Actif</span>`
      : `<span class="badge rounded-pill bg-secondary">Inactif</span>`
  );
}

async function changeStatusObject(status) {
  try {
    const swalResult = await Swal.fire({
      title: `Voulez-vous vraiment ${status === 'enabled' ? 'activer' : 'désactiver'} le collaborateur ${object.code}?`,
      text: 'Cette opération est irréversible',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Oui',
      cancelButtonText: 'Non',
    });

    if (!swalResult.isConfirmed) throw {};

    swalLoading();

    const { data } = await ajax({
      url: `${API_BASEURL}/collabs/change-status/${object.id}`,
      type: 'POST',
      data: { status },
    });

    Toast.fire(data.message, '', 'success');
    location.reload();
  } catch ({ error }) {
    Swal.fire(error.responseJSON?.message || 'Erreur', '', 'error');
  }
}

async function deleteObject() {
  try {
    const swalResult = await Swal.fire({
      title: `Voulez-vous vraiment supprimer le collaborateur ${object.code}?`,
      text: 'Cette opération est irréversible',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Oui',
      cancelButtonText: 'Non',
    });

    if (!swalResult.isConfirmed) throw {};

    swalLoading();

    const { data } = await ajax({
      url: `${API_BASEURL}/collabs/delete/${object.id}`,
      type: 'POST',
    });

    Toast.fire(data.message, '', 'success');
    location = '/collabs';
  } catch ({ error }) {
    Swal.fire(error.responseJSON?.message || 'Erreur', '', 'error');
  }
}

window.render = async function () {
  await fetchObject();
  setTitle(`Details du collaborateur ${object.code} (${object.first_name} ${object.last_name})`);
  displayObject();

  $('#enable').click(async () => await changeStatusObject('enabled'));
  $('#disable').click(async () => await changeStatusObject('disabled'));
  $('#delete').click(async () => await deleteObject());

  if (object.status !== 'disabled') $('#enable').hide();
  if (object.status !== 'enabled') $('#disable').hide();

 // ─────────────── AJUSTEMENT SOLDE ───────────────
const $balance  = $('#collabBalance');
const $currency = $('#collabCurrency');

// utilitaire: on vise l'id du user si dispo, sinon fallback sur object.id
function targetId () {
  return (object && typeof object.user_id !== 'undefined' && object.user_id)
    ? object.user_id
    : object.id;
}

async function refreshBalance() {
  try {
    // GET JSON côté web (route /admin/collabs/{id}/balance) — on passe le bon id
    const res = await $.get(`/admin/collabs/${targetId()}/balance`);
    if (res?.ok) {
      // format simple (tu peux remplacer par formatAmountSpaced si tu veux “xx xxx FCFA”)
      $balance.text(res.balance);
      $currency.text(res.currency || '');
    }
  } catch (e) {
    console.error('Erreur refreshBalance:', e);
  }
}

$('#btnOpenAdjust').on('click', () => $('#modalAdjustBalance').modal('show'));

/*$('#formAdjustBalance').on('submit', async function (e) {
  e.preventDefault();
  const form = $(this);
  const payload = {
    direction: form.find('[name="direction"]').val(),
    amount:    form.find('[name="amount"]').val(),
    reason:    form.find('[name="reason"]').val(),
  };

  try {
    Swal.fire({
      title: 'Traitement...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    // POST sur l’id correct (user_id prioritaire)
    const { data } = await ajax({
      url: `/admin/collabs/${targetId()}/balance/adjust`,
      type: 'POST',
      data: payload,
      headers: { 'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content') || '' },
    });

    Swal.close();

    if (data?.ok) {
      await Swal.fire(data.message || 'Solde mis à jour.', '', 'success');
      $('#modalAdjustBalance').modal('hide');
      refreshBalance();
    } else {
      await Swal.fire(data?.message || 'Erreur.', '', 'error');
    }
  } catch (err) {
    Swal.close();
    console.error('Erreur adjust balance:', err);
    const msg = err?.responseJSON?.message || err?.message || 'Erreur.';
    Swal.fire(msg, '', 'error');
  }
});*/

$('#formAdjustBalance').on('submit', async function (e) {
  e.preventDefault();
  const form = $(this);

  // ——— Sanitize montant: supprime espaces, points, etc. pour garder un entier XOF ———
  const rawAmount = form.find('[name="amount"]').val();
  const cleanedAmount = String(rawAmount || '')
    .replace(/\s+/g, '')    // enlève espaces
    .replace(/,/g, '')      // enlève virgules 1,000
    .replace(/\./g, '');    // enlève points 1.000
  const amountInt = parseInt(cleanedAmount, 10) || 0;

  const payload = {
    direction: form.find('[name="direction"]').val(),
    amount: amountInt, // on envoie un entier propre
    reason: form.find('[name="reason"]').val(),
  };

  try {
    Swal.fire({
      title: 'Traitement...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    // debug utile en cas de CSRF
    const csrf = $('meta[name="csrf-token"]').attr('content') || '';
    console.log('[adjust] POST /admin/collabs/'+object.id+'/balance/adjust', payload, 'csrf?', !!csrf);

    const { data } = await ajax({
      url: `/admin/collabs/${object.id}/balance/adjust`,
      type: 'POST',
      data: payload,
      headers: { 'X-CSRF-TOKEN': csrf },
    });

    Swal.close();

    if (data?.ok) {
      await Swal.fire(data.message || 'Solde mis à jour.', '', 'success');
      $('#modalAdjustBalance').modal('hide');
      refreshBalance();
    } else {
      // le contrôleur peut renvoyer ok:false (422 solde insuffisant par ex.)
      await Swal.fire(data?.message || 'Erreur.', '', 'error');
    }
  } catch (err) {
    Swal.close();
    // Montrer l'erreur REELLE (status + body) pour qu’on sache quoi corriger
    const status = err?.status || err?.error?.status || '???';
    const body = err?.responseJSON?.message || err?.error?.responseJSON?.message || err?.responseText || err?.error?.responseText || err?.message || 'Erreur.';
    console.error('Erreur adjust balance:', { status, err });
    Swal.fire(`Erreur (${status})`, body, 'error');
  }
});


// Premier affichage du solde
refreshBalance();
};
