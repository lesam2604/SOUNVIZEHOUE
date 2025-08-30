/* resources/js/operations/view.js */

let object = null;
let opType = null;

function fetchOpType() {
  const opTypeCode = $('#opTypeCode').val();
  opType = SETTINGS.opTypes.find((o) => o.code === opTypeCode);
}

async function fetchObject() {
  const objectId = $('#objectId').val();
  if (objectId) {
    try {
      const { data } = await ajax({
        url: `${API_BASEURL}/operations/${opType.code}/fetch/${objectId}`,
        type: 'GET',
      });
      object = data;
    } catch ({ error }) {
      await Swal.fire(error.responseJSON.message, '', 'error');
      location = `/operations/${opType.code}`;
    }
  }
}
/*function fetchOpType() {
  let opTypeCode = $('#opTypeCode').val();
  opType = SETTINGS.opTypes.find((opType) => opType.code === opTypeCode);
}

async function fetchObject() {
  let objectId = $('#objectId').val();
  if (objectId) {
    try {
      let { data } = await ajax({
        url: `${API_BASEURL}/operations/${opType.code}/fetch/${objectId}`,
        type: 'GET',
      });
      object = data;
    } catch ({ error }) {
      await Swal.fire(error.responseJSON.message, '', 'error');
      location = `/operations/${opType.code}`;
    }
  }
}*/




/*function fetchOpType() {
  let opTypeCode = $('#opTypeCode').val();
  opType = SETTINGS.opTypes.find((opType) => opType.code === opTypeCode);
}

async function fetchObject() {
  let objectId = $('#objectId').val();
  if (objectId) {
    try {
      let { data } = await ajax({
        url: `${API_BASEURL}/operations/${opType.code}/fetch/${objectId}`,
        type: 'GET',
      });
      object = data;
    } catch ({ error }) {
      await Swal.fire(error.responseJSON.message, '', 'error');
      location = `/operations/${opType.code}`;
    }
  }
}*/








function displayObject() {
  if (['account_recharge', 'balance_withdrawal'].includes(opType.code)) {
    $('#blockCommissions').hide();
  } else {
    let amount = parseInt(object.amount);
    let fee = parseInt(object.fee);
    let commission = parseInt(object.commission);

    $('#amount').html(formatAmount(amount));
    $('#fee').html(formatAmount(fee));
    $('#totalAmount').html(formatAmount(amount + fee));
    $('#commission').html(formatAmount(commission));
    $('#commissionPlatform').html(
      formatAmount(fee > commission ? fee - commission : 0)
    );
  }

  $('#codePartner').html(object.partner.user.code);
  $('#firstName').html(object.partner.user.first_name);
  $('#lastName').html(object.partner.user.last_name);
  $('#companyName').html(object.company.name);
  $('#tin').html(object.company.tin);

  switch (object.status) {
    case 'pending':
      $('#status').html('<span class="badge bg-secondary">En attente</span>');
      break;
    case 'approved':
      $('#status').html('<span class="badge bg-success">ValidÃ©e</span>');
      break;
    case 'rejected':
      $('#status').html('<span class="badge bg-danger">RejetÃ©e</span>');
      break;
  }

  $('#reviewer').html(
    object.status === 'pending'
      ? ''
      : `${object.reviewer.first_name} ${object.reviewer.last_name}`
  );

  $('#reviewedAt').html(object.status === 'pending' ? '' : object.reviewed_at);

  $('#feedback').html(object.feedback ? object.feedback : '');

  const tBody = $('#tableOperation tbody');

  for (const [fieldName, fieldData] of opType.sorted_fields) {
    if (fieldName === opType.amount_field) {
      continue;
    }

    let content = null;

    if ((object.data[fieldName] ?? null) === null) {
      content = '';
    } else {
      switch (fieldData.type) {
        case 'select':
        case 'text':
        case 'textarea':
        case 'email':
        case 'date':
        case 'datetime':
          content = object.data[fieldName];
          break;
        case 'number':
          content = fieldData.is_amount
            ? formatAmount(object.data[fieldName])
            : object.data[fieldName];
          break;
        case 'file':
          content = `<a class="btn btn-outline-primary" target="_blank" href="${getUploadUrl(
            object.data[fieldName]
          )}"><i class="fas fa-eye"></i><a>`;
          break;
        case 'card':
          content = object.data[fieldName];
          break;
        case 'country':
          content = `<img src="${getCountryFlagUrl(
            object.countries[fieldName].code
          )}"> ${object.countries[fieldName].name}`;
          break;
      }
    }

    if (opType.code === 'account_recharge' && fieldName === 'trans_amount') {
      tBody.append(`
        <tr>
          <th>Montant avant prÃ©lÃ¨vement</th>
          <td>${formatAmount(
            object.data.sender_phone_number_type === 'MomoPay'
              ? object.data.trans_amount / (1 - 0.005)
              : object.data.trans_amount
          )}</td>
        </tr>
        <tr>
          <th>Frais (MomoPay)</th>
          <td>${formatAmount(
            object.data.sender_phone_number_type === 'MomoPay'
              ? (object.data.trans_amount * 0.005) / (1 - 0.005)
              : 0
          )}</td>
        </tr>
      `);
    }

    if (
      opType.code === 'card_recharge' &&
      ['client_first_name', 'client_last_name'].includes(fieldName)
    ) {
      content = `<span class="fw-bold text-danger">${content}</span>`;
    }

    tBody.append(`
      <tr>
        <th>${fieldData.label}</th>
        <td>${content}</td>
      </tr>
    `);
  }

  if (USER.hasRole('reviewer') && opType.code === 'card_activation') {
    if (object.duplicates) {
      $('#alertMessage')
        .html(
          `Ce client a dÃ©jÃ  fait l'object ${
            object.duplicates === 1
              ? `d'une autre activation de carte approuvÃ©e`
              : `de ${object.duplicates} autres activations de cartes approuvÃ©es`
          }`
        )
        .show();
    }
  }
}

async function approveObject() {
  try {
    let swalResult = await Swal.fire({
      title: `Voulez-vous vraiment valider l'opÃ©ration ${opType.name} ${object.code}?`,
      text: 'Cette opÃ©ration est irreversible',
      input: 'textarea',
      inputPlaceholder: 'Vous pouvez laisser un feedback ici...',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Oui',
      cancelButtonText: 'Non',
    });

    if (!swalResult.isConfirmed) {
      throw {};
    }

    swalLoading();

    let { data } = await ajax({
      url: `${API_BASEURL}/operations/${opType.code}/approve/${object.id}`,
      type: 'POST',
      data: {
        feedback: swalResult.value,
        without_commission: false,
      },
    });

    Toast.fire(data.message, '', 'success');
    location.reload();
  } catch ({ error }) {
    Swal.fire(error.responseJSON.message, '', 'error');
  }
}

async function approveObjectWithoutCommission() {
  try {
    let swalResult = await Swal.fire({
      title: `Voulez-vous vraiment valider l'opÃ©ration ${opType.name} ${object.code} sans les commissions?`,
      text: 'Cette opÃ©ration est irreversible. Et le partenaire ne recevra pas de commissions.',
      input: 'textarea',
      inputPlaceholder: 'Vous pouvez laisser un feedback ici...',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Oui',
      cancelButtonText: 'Non',
    });

    if (!swalResult.isConfirmed) {
      throw {};
    }

    swalLoading();

    let { data } = await ajax({
      url: `${API_BASEURL}/operations/${opType.code}/approve/${object.id}`,
      type: 'POST',
      data: {
        feedback: swalResult.value,
        without_commission: true,
      },
    });

    Toast.fire(data.message, '', 'success');
    location.reload();
  } catch ({ error }) {
    Swal.fire(error.responseJSON.message, '', 'error');
  }
}

async function rejectObject() {
  try {
    let swalResult = await Swal.fire({
      title: `Voulez-vous vraiment rejeter l'opÃ©ration ${opType.name} ${object.code}?`,
      text: 'Cette opÃ©ration est irreversible',
      input: 'textarea',
      inputPlaceholder: 'Vous pouvez laisser un feedback ici...',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Oui',
      cancelButtonText: 'Non',
    });

    if (!swalResult.isConfirmed) {
      throw {};
    }

    swalLoading();

    let { data } = await ajax({
      url: `${API_BASEURL}/operations/${opType.code}/reject/${object.id}`,
      type: 'POST',
      data: {
        feedback: swalResult.value,
      },
    });

    Toast.fire(data.message, '', 'success');
    location.reload();
  } catch ({ error }) {
    Swal.fire(error.responseJSON.message, '', 'error');
  }
}

async function deleteObject() {
  try {
    let swalResult = await Swal.fire({
      title: `Voulez-vous vraiment supprimer l'opÃ©ration ${opType.name} ${object.code}?`,
      text: 'Cette opÃ©ration est irreversible',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Oui',
      cancelButtonText: 'Non',
    });

    if (!swalResult.isConfirmed) {
      throw {};
    }

    swalLoading();

    let { data } = await ajax({
      url: `${API_BASEURL}/operations/${opType.code}/delete/${object.id}`,
      type: 'POST',
    });

    Toast.fire(data.message, '', 'success');
    location = `/operations/${opType.code}`;
  } catch ({ error }) {
    Swal.fire(error.responseJSON.message, '', 'error');
  }
}

/**
 * Ajoute le bouton "Demander l'annulation" pour les collaborateurs
 * uniquement si l'opÃ©ration est validÃ©e. La requÃªte est envoyÃ©e vers l'API.
 */
/*function addCancelButtonIfAllowed() {
  const isCollab = typeof USER?.hasRole === 'function' && USER.hasRole('collab');
  const isApproved = !!object && object.status === 'approved';

  const $actionsCardBody = $('.card-header h4')
    .filter(function () {
      return $(this).text().trim() === 'Actions';
    })
    .closest('.card')
    .find('.card-body')
    .first();

  if (!isCollab || !isApproved || !$actionsCardBody.length) return;

  if (!$('#btnCancelOp').length) {
    const $btn = $(`
      <button type="button" class="btn btn-lg btn-outline-danger ms-2" id="btnCancelOp">
        <i class="fas fa-undo me-2"></i> Demander l'annulation
      </button>
    `);
    $actionsCardBody.append($btn);

    $('#btnCancelOp').on('click', async function () {
      const csrf = $('meta[name="csrf-token"]').attr('content') || '';

      const confirmation = await Swal.fire({
        title: 'Confirmer',
        text: "Voulez-vous envoyer une demande d'annulation pour cette opÃ©rationÂ ?",
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Oui, envoyer',
        cancelButtonText: 'Annuler',
      });
      if (!confirmation.isConfirmed) return;

      Swal.fire({
        title: 'Envoi en cours...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      try {
        // Utilise l'API versionnÃ©e (auth:sanctum)
        const response = await $.ajax({
          url: `${API_BASEURL}/operations-cancel/request/${object.id}`,
          method: 'POST',
          dataType: 'json',
          headers: {
            'X-CSRF-TOKEN': csrf,
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        Swal.fire(response.message || 'Demande envoyÃ©e.', '', 'success');
        $('#btnCancelOp').prop('disabled', true);
      } catch (err) {
        const message =
          err?.responseJSON?.message ||
          err?.responseText ||
          err?.message ||
          "Erreur pendant l'envoi de la demande.";
        Swal.fire(message, '', 'error');
      }
    });
  }
}

window.render = async function () {
  fetchOpType();
  await fetchObject();

  setTitle(`${opType.name} ${object.code}`);

  $('#linkList')
    .html(`<i class="fas fa-list"></i> Liste des opÃ©rations`)
    .attr('href', `/operations/${opType.code}`);

  displayObject();
  addCancelButtonIfAllowed(); // importantÂ : aprÃ¨s displayObject()

  $('#edit').click(function () {
    location = `/operations/${opType.code}/${object.id}/edit`;
  });

  $('#approve').click(function () {
    approveObject();
  });

  $('#approveWithoutCommission').click(function () {
    approveObjectWithoutCommission();
  });*/






  /*function addCancelButtonIfAllowed() {
  const isCollab  = typeof USER?.hasRole === 'function' && USER.hasRole('collab');
  const isApproved = !!object && object.status === 'approved';

  const $actionsCardBody = $('.card-header h4')
    .filter(function () { return $(this).text().trim() === 'Actions'; })
    .closest('.card')
    .find('.card-body')
    .first();

  if (!isCollab || !isApproved || !$actionsCardBody.length) return;

  if (!$('#btnCancelOp').length) {
    const $btn = $(`
      <button type="button" class="btn btn-lg btn-outline-danger ms-2" id="btnCancelOp">
        <i class="fas fa-undo me-2"></i> Demander l'annulation
      </button>
    `);
    $actionsCardBody.append($btn);

    $('#btnCancelOp').on('click', async function () {
      const csrf = $('meta[name="csrf-token"]').attr('content') || '';

      const confirm = await Swal.fire({
        title: 'Confirmer',
        text: "Envoyer une demande d'annulationÂ ?",
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Oui',
        cancelButtonText: 'Non',
      });
      if (!confirm.isConfirmed) return;

      Swal.fire({
        title: 'Envoi en cours...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      try {
        // Envoi via lâ€™API (auth:sanctum)
        const res = await $.ajax({
          url: `${API_BASEURL}/operations-cancel/request/${object.id}`,
          method: 'POST',
          dataType: 'json',
          headers: { 
            'X-CSRF-TOKEN': csrf,
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        Swal.fire(res.message || 'Demande envoyÃ©e.', '', 'success');
        $('#btnCancelOp').prop('disabled', true);
      } catch (err) {
        const msg =
          err?.responseJSON?.message ||
          err?.responseText ||
          err?.message ||
          "Erreur pendant l'envoi.";
        Swal.fire(msg, '', 'error');
      }
    });
  }
}

window.render = async function () {
  fetchOpType();
  await fetchObject();

  setTitle(`${opType.name} ${object.code}`);

  $('#linkList')
    .html(`<i class="fas fa-list"></i> Liste des opÃ©rations`)
    .attr('href', `/operations/${opType.code}`);

  displayObject();
  addCancelButtonIfAllowed();

  $('#edit').click(function () {
    location = `/operations/${opType.code}/${object.id}/edit`;
  });

  $('#approve').click(function () {
    approveObject();
  });

  $('#approveWithoutCommission').click(function () {
    approveObjectWithoutCommission();
  });

  $('#reject').click(function () {
    rejectObject();
  });

  $('#delete').click(function () {
    deleteObject();
  });

  if (object.status !== 'rejected') $('#edit').hide();
  if (object.status !== 'pending') {
    $('#approve').hide();
    $('#reject').hide();
  }
  if (
    object.status !== 'pending' ||
    ['account_recharge', 'balance_withdrawal'].includes(opType.code) ||
    (!hasCommissions(object.master, opType.id, object.data.card_type || null) &&
      opType.code !== 'card_activation')
  ) {
    $('#approveWithoutCommission').hide();
  }
 };*/
















 /**
 * Ajoute le bouton â€œDemander l'annulationâ€ :
 * - uniquement si l'utilisateur a le rÃ´le collab
 * - uniquement si l'opÃ©ration est â€œapprovedâ€
 * L'appel part vers lâ€™API Sanctum : /api/v1/operations-cancel/request/{id}
 */
function addCancelButtonIfAllowed() {
  const isCollab  = typeof USER?.hasRole === 'function' && USER.hasRole('collab');
  const isApproved = !!object && object.status === 'approved';

  const $actionsCardBody = $('.card-header h4')
    .filter(function () { return $(this).text().trim() === 'Actions'; })
    .closest('.card')
    .find('.card-body')
    .first();

  if (!isCollab || !isApproved || !$actionsCardBody.length) return;

  if (!$('#btnCancelOp').length) {
    const $btn = $(`
      <button type="button" class="btn btn-lg btn-outline-danger ms-2" id="btnCancelOp">
        <i class="fas fa-undo me-2"></i> Demander l'annulation
      </button>
    `);
    $actionsCardBody.append($btn);

    $('#btnCancelOp').on('click', async function () {
      const csrf = $('meta[name="csrf-token"]').attr('content') || '';

      const { value: reason } = await Swal.fire({
        title: "Demander l'annulation",
        input: 'textarea',
        inputPlaceholder: 'Motif (obligatoire)',
        inputAttributes: { 'aria-label': 'Motif' },
        showCancelButton: true,
        confirmButtonText: 'Envoyer',
        cancelButtonText: 'Annuler',
        preConfirm: (val) => {
          if (!val || !val.trim()) {
            Swal.showValidationMessage('Le motif est requis');
          }
          return val;
        }
      });
      if (!reason) return;

      Swal.fire({
        title: 'Envoi en cours...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      try {
        // Envoi Ã  lâ€™API versionnÃ©e : /api/v1/operations-cancel/request/{operationId}
        const res = await $.ajax({
          url: `${API_BASEURL}/operations-cancel/request/${object.id}`,
          method: 'POST',
          dataType: 'json',
          data: { reason },
          headers: {
            'X-CSRF-TOKEN': csrf,
            'X-Requested-With': 'XMLHttpRequest',
          }
        });
        Swal.fire(res.message || 'Demande envoyÃ©e.', '', 'success');
        $('#btnCancelOp').prop('disabled', true);
      } catch (err) {
        const msg = err?.responseJSON?.message || err?.responseText || err?.message || "Erreur";
        Swal.fire(msg, '', 'error');
      }
    });
  }
}

window.render = async function () {
  fetchOpType();
  await fetchObject();
  setTitle(`${opType.name} ${object.code}`);
  $('#linkList').html(`<i class="fas fa-list"></i> Liste des opÃ©rations`)
               .attr('href', `/operations/${opType.code}`);

  displayObject();
  addCancelButtonIfAllowed();

  $('#edit').click(() => location = `/operations/${opType.code}/${object.id}/edit`);
  $('#approve').click(approveObject);
  $('#approveWithoutCommission').click(approveObjectWithoutCommission);
  $('#reject').click(rejectObject);
  $('#delete').click(deleteObject);

  if (object.status !== 'rejected') $('#edit').hide();
  if (object.status !== 'pending') {
    $('#approve').hide();
    $('#reject').hide();
  }
  if (
    object.status !== 'pending' ||
    ['account_recharge','balance_withdrawal'].includes(opType.code) ||
    (!hasCommissions(object.master, opType.id, object.data.card_type || null) && opType.code !== 'card_activation')
  ) {
    $('#approveWithoutCommission').hide();
  }
};















  $('#reject').click(function () {
    rejectObject();
  });

  $('#delete').click(function () {
    deleteObject();
  });

  if (object.status !== 'rejected') {
    $('#edit').hide();
  }

  if (object.status !== 'pending') {
    $('#approve').hide();
    $('#reject').hide();
  }

  if (
    object.status !== 'pending' ||
    ['account_recharge', 'balance_withdrawal'].includes(opType.code) ||
    (!hasCommissions(object.master, opType.id, object.data.card_type || null) &&
      opType.code !== 'card_activation')
  ) {
    $('#approveWithoutCommission').hide();
  }
