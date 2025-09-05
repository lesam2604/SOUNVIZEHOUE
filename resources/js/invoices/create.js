async function populateOpTypes() {
  // Utilise SETTINGS.opTypes s'il est global, sinon requête minimaliste
  try {
    if (typeof SETTINGS !== 'undefined' && Array.isArray(SETTINGS.opTypes)) {
      const sel = $('#opTypeCode');
      sel.html('');
      SETTINGS.opTypes.forEach(ot => sel.append(`<option value="${ot.code}">${ot.name}</option>`));
      return;
    }
  } catch {}
}

function initPartnerSelector() {
  $('#partnerId').select2({
    theme: 'bootstrap-5',
    placeholder: 'Rechercher un partenaire (code, nom, société)',
    allowClear: true,
    ajax: {
      transport: function (params, success, failure) {
        $.ajax({
          url: `${API_BASEURL}/partners/fetch-by-term`,
          type: 'GET',
          data: { term: params.data.term || '' },
          success,
          error: failure,
        });
      },
      delay: 250,
      processResults: function (data) {
        const results = (data || []).map(p => ({
          id: p.id,
          text: `${p.code} - ${p.first_name} ${p.last_name}${p.company_name ? ' ('+p.company_name+')' : ''}`
        }));
        return { results };
      }
    }
  });
}

function toggleClientBlocks() {
  const t = $('#clientType').val();
  if (t === 'partner') {
    $('#partnerSelectBlock').show();
    $('#manualClientBlock').hide();
  } else {
    $('#partnerSelectBlock').hide();
    $('#manualClientBlock').show();
  }
}

function addItemRow(item = { label: '', qty: 1, unit: 0 }) {
  const tr = $(
    `<tr>
      <td><input type="text" class="form-control item-label" placeholder="Désignation" value="${item.label}"></td>
      <td><input type="number" min="1" class="form-control item-qty" value="${item.qty}"></td>
      <td><input type="number" min="0" class="form-control item-unit" value="${item.unit}"></td>
      <td><button type="button" class="btn btn-sm btn-outline-danger btn-del"><i class="fas fa-trash"></i></button></td>
    </tr>`
  );
  tr.find('.btn-del').on('click', () => tr.remove());
  $('#itemsTable tbody').append(tr);
  if (window.LOCK_INVOICE_MODE) {
    tr.find('.item-label').prop('disabled', true);
    tr.find('.item-qty').prop('disabled', true);
    tr.find('.btn-del').prop('disabled', true).hide();
  }
}

function gatherItems() {
  const items = [];
  $('#itemsTable tbody tr').each(function () {
    const label = $(this).find('.item-label').val() || '';
    const qty = parseFloat($(this).find('.item-qty').val() || '0');
    const unit = parseFloat($(this).find('.item-unit').val() || '0');
    if (label && qty > 0) {
      items.push({ label, qty, unit });
    }
  });
  return items;
}

async function submitForm(e) {
  e.preventDefault();
  try {
    swalLoading();
    const opTypeCode = $('#opTypeCode').val();
    const clientType = $('#clientType').val();
    const payload = {
      client_type: clientType,
      amount: $('#amount').val(),
      items: gatherItems(),
    };
    if (clientType === 'partner') {
      const pid = $('#partnerId').val();
      if (!pid) {
        Swal.close();
        return Toast.fire('Sélectionnez un partenaire', '', 'error');
      }
      payload.partner_id = pid;
    } else {
      payload.client_name = $('#client_name').val();
      payload.client_phone = $('#client_phone').val();
      payload.client_email = $('#client_email').val();
    }

    const { data } = await ajax({
      url: `${API_BASEURL}/invoices/${opTypeCode}/store`,
      type: 'POST',
      data: payload,
    });

    Toast.fire(data.message || 'Facture créée', '', 'success');
    location = `/invoices/${data.invoice.id}`;
  } catch ({ error }) {
    console.log(error);
    if (error?.responseJSON?.errors) Swal.close();
    showErrors(error.responseJSON || { message: 'Erreur' });
  }
}

function prefillFromQuery() {
  try {
    const q = new URLSearchParams(location.search);
    const opTypeCode = q.get('opTypeCode');
    const clientType = q.get('clientType'); // 'partner' | 'external'
    const partnerId = q.get('partnerId');
    const partnerText = q.get('partnerText');
    const amount = q.get('amount');
    const items = q.get('items');
    const clientName = q.get('client_name');
    const clientPhone = q.get('client_phone');
    const clientEmail = q.get('client_email');
    const lock = q.get('lock');

    if (opTypeCode) $('#opTypeCode').val(opTypeCode);
    if (clientType) $('#clientType').val(clientType);
    toggleClientBlocks();

    if (clientType === 'partner' && partnerId) {
      const opt = new Option(partnerText || partnerId, partnerId, true, true);
      $('#partnerId').append(opt).trigger('change');
    }

    if (clientType === 'external') {
      if (clientName) $('#client_name').val(clientName);
      if (clientPhone) $('#client_phone').val(clientPhone);
      if (clientEmail) $('#client_email').val(clientEmail);
    }

    if (amount) $('#amount').val(parseInt(amount));
    if (items) {
      try {
        const arr = JSON.parse(items);
        if (Array.isArray(arr)) {
          $('#itemsTable tbody').html('');
          arr.forEach(it => addItemRow(it));
        }
      } catch {}
    }
  } catch (e) {
    console.log(e);
  }
}

function applyLockModeIfNeeded() {
  const q = new URLSearchParams(location.search);
  const lock = q.get('lock');
  if (!lock) return;
  window.LOCK_INVOICE_MODE = true;
  $('#opTypeCode').prop('disabled', true);
  $('#clientType').prop('disabled', true);
  $('#partnerId').prop('disabled', true);
  $('#manualClientBlock :input').prop('disabled', true);
  $('#manualClientBlock').hide();
  $('#itemsTable tbody tr').each(function(){
    $(this).find('.item-label').prop('disabled', true);
    $(this).find('.item-qty').prop('disabled', true);
    $(this).find('.btn-del').prop('disabled', true).hide();
  });
}

window.render = async function () {
  await populateOpTypes();
  initPartnerSelector();
  $('#clientType').on('change', toggleClientBlocks);
  toggleClientBlocks();
  prefillFromQuery();
  applyLockModeIfNeeded();
  $('#addItemBtn').on('click', () => addItemRow());
  $('#form').on('submit', submitForm);
};
