let object = null;
let opType = null;

function fetchOpType() {
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
}

function clearForm() {
  for (const [fieldName, fieldData] of opType.sorted_fields) {
    if (fieldData.stored) {
      if (fieldName === opType.amount_field) {
        $(`#${fieldName}`).val('0').keyup();
      } else {
        switch (fieldData.type) {
          case 'select':
          case 'text':
          case 'textarea':
          case 'email':
          case 'file':
          case 'date':
          case 'datetime':
            $(`#${fieldName}`).val('');
            break;
          case 'number':
            $(`#${fieldName}`).val('0');
            break;
          case 'card':
            $(`#${fieldName}`).val('');
            $(`#${fieldName}_digits`).val('10').change();
            break;
          case 'country':
            $(`#${fieldName}`).val(24).change();
            break;
        }
      }
    }
  }

  $('.update-file-helper').hide();
  $('.is-invalid').removeClass('is-invalid');
}

function setForm() {
  for (const [fieldName, fieldData] of opType.sorted_fields) {
    if (fieldData.updated) {
      if (
        opType.code === 'account_recharge' &&
        fieldName === 'trans_amount' &&
        object.data.sender_phone_number_type === 'MomoPay'
      ) {
        $(`#${fieldName}`).val(object.data[fieldName] / (1 - 0.005));
      } else if (fieldName === opType.amount_field) {
        $(`#${fieldName}`).val(object.data[fieldName]).keyup();
      } else {
        switch (fieldData.type) {
          case 'select':
          case 'text':
          case 'textarea':
          case 'email':
          case 'date':
          case 'datetime':
          case 'number':
            $(`#${fieldName}`).val(object.data[fieldName]);
            break;
          case 'card':
            $(`#${fieldName}`).val(object.data[fieldName]);
            $(`#${fieldName}_digits`)
              .val(object.data[fieldName].length)
              .change();
            break;
          case 'country':
            $(`#${fieldName}`).val(object.data[fieldName]).change();
            break;
          case 'file':
            $(`#${fieldName}`).val('');
            break;
        }
      }
    }
  }
}

function initPartnerSelector() {
  try {
    const canChoosePartner = typeof USER?.hasRole === 'function' && (USER.hasRole('collab') || USER.hasRole('reviewer') || USER.hasRole('admin'));
    if (!canChoosePartner) {
      $('#partnerSelectBlock').hide();
      return;
    }

    $('#partnerSelectBlock').show();
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
  } catch (e) {
    console.warn('initPartnerSelector error:', e);
  }
}

async function createObject() {
  swalLoading();

  let formData = new FormData();

  for (const [fieldName, fieldData] of opType.sorted_fields) {
    if (fieldData.stored) {
      switch (fieldData.type) {
        case 'select':
        case 'text':
        case 'textarea':
        case 'email':
        case 'country':
        case 'date':
        case 'datetime':
        case 'number':
          formData.append(fieldName, $(`#${fieldName}`).val());
          break;
        case 'card':
          formData.append(
            fieldName,
            $(`#${fieldName}`).val().replace(/\D/g, '')
          );
          break;
        case 'file':
          formData.append(fieldName, $(`#${fieldName}`)[0].files[0] ?? '');
          break;
      }
    }
  }

  try {
    let endpoint = `${API_BASEURL}/operations/${opType.code}/store`;
    const selectedPartnerId = $('#partnerId').val();
    if (selectedPartnerId) {
      endpoint = `${API_BASEURL}/operations/${opType.code}/store-for-partner/${selectedPartnerId}`;
    }

    let { data } = await ajax({
      url: endpoint,
      type: 'POST',
      contentType: false,
      processData: false,
      data: formData,
    });

    Toast.fire(data.message, '', 'success');
    clearForm();
  } catch ({ error }) {
    console.log(error);
    if (error.responseJSON.errors) {
      Swal.close();
    }

    showErrors(error.responseJSON);
  }
}

async function updateObject() {
  swalLoading();

  let formData = new FormData();

  for (const [fieldName, fieldData] of opType.sorted_fields) {
    if (fieldData.updated) {
      switch (fieldData.type) {
        case 'select':
        case 'text':
        case 'textarea':
        case 'email':
        case 'country':
        case 'date':
        case 'datetime':
        case 'number':
          formData.append(fieldName, $(`#${fieldName}`).val());
          break;
        case 'card':
          formData.append(
            fieldName,
            $(`#${fieldName}`).val().replace(/\D/g, '')
          );
          break;
        case 'file':
          formData.append(fieldName, $(`#${fieldName}`)[0].files[0] ?? '');
          break;
      }
    }
  }

  try {
    let { data } = await ajax({
      url: `${API_BASEURL}/operations/${opType.code}/update/${object.id}`,
      type: 'POST',
      contentType: false,
      processData: false,
      data: formData,
    });

    Toast.fire(data.message, '', 'success');
    location = `/operations/${opType.code}/${object.id}`;
  } catch ({ error }) {
    console.log(error);
    if (error.responseJSON.errors) {
      Swal.close();
    }

    showErrors(error.responseJSON);
  }
}

function initFields() {
  const blockSubmit = $('#blockSubmit');

  for (const [fieldName, fieldData] of opType.sorted_fields) {
    if (fieldData.created || fieldData.updated) {
      let content = null;
      let ifRequired = fieldData.required ? 'required' : '';

      switch (fieldData.type) {
        case 'select':
          content = `
            <div class="col-12 col-lg-6 mb-3">
              <label for="${fieldName}" class="form-label">${
            fieldData.label
          }</label>
              <select id="${fieldName}" class="form-select">
                <option value="">--Sélectionnez--</option>
                ${fieldData.options
                  .map((value) => `<option value="${value}">${value}</option>`)
                  .join('')}
              </select>
              <div class="invalid-feedback"></div>
            </div>`;
          break;

        case 'text':
        case 'textarea':
          let attributes = '';
          if (fieldData.attributes) {
            for (const key in fieldData.attributes) {
              attributes += `${key}="${fieldData.attributes[key]}" `;
            }
          }
          content = `
            <div class="col-12 col-lg-6 mb-3">
              <label for="${fieldName}" class="form-label">${
            fieldData.label
          }</label>
              ${
                fieldData.type === 'text'
                  ? `<input type="text" class="form-control" id="${fieldName}" placeholder="${fieldData.label}"
                  ${ifRequired} maxlength="191" ${attributes}></input>`
                  : `<textarea class="form-control" id="${fieldName}" placeholder="${fieldData.label}"
                  ${ifRequired} maxlength="1000"></textarea>`
              }
              <div class="invalid-feedback"></div>
            </div>
          `;
          break;

        case 'email':
          content = `
            <div class="col-12 col-lg-6 mb-3">
              <label for="${fieldName}" class="form-label">${fieldData.label}</label>
              <input type="email" class="form-control" id="${fieldName}" placeholder="${fieldData.label}"
                ${ifRequired} maxlength="191">
              <div class="invalid-feedback"></div>
            </div>
          `;
          break;

        case 'country':
          content = `
            <div class="col-12 col-lg-6 mb-3">
              <label for="${fieldName}" class="form-label">${fieldData.label}</label>
              <select id="${fieldName}" class="form-select" ${ifRequired}></select>
              <div class="invalid-feedback"></div>
            </div>
          `;
          break;

        case 'date':
          content = `
            <div class="col-12 col-lg-6 mb-3">
              <label for="${fieldName}" class="form-label">${
            fieldData.label
          }</label>
              <input type="date" class="form-control" id="${fieldName}" placeholder="${
            fieldData.label
          }"
                ${
                  fieldData.lte_today
                    ? `max="${moment().format('YYYY-MM-DD')}"`
                    : ''
                } ${ifRequired}>
              <div class="invalid-feedback"></div>
            </div>
          `;
          break;

        case 'datetime':
          content = `
            <div class="col-12 col-lg-6 mb-3">
              <label for="${fieldName}" class="form-label">${
            fieldData.label
          }</label>
              <input type="datetime-local" class="form-control" id="${fieldName}" placeholder="${
            fieldData.label
          }"
                ${
                  fieldData.lte_today
                    ? `max="${moment().format('YYYY-MM-DD HH:mm:ss')}"`
                    : ''
                } ${ifRequired}>
              <div class="invalid-feedback"></div>
              </div>
          `;
          break;

        case 'number':
          content = `
            <div class="col-12 col-lg-6 mb-3">
              <label for="${fieldName}" class="form-label">${fieldData.label}</label>
              <input type="number" class="form-control" id="${fieldName}" placeholder="${fieldData.label}" ${ifRequired}>
              <div class="invalid-feedback"></div>
            </div>
          `;
          break;

        case 'card':
          content = `
            <div class="col-12 col-lg-6 mb-3">
              <label for="${fieldName}" class="form-label">${fieldData.label}</label>
              <div class="input-group mb-3">
                <select id="${fieldName}_digits" class="form-select flex-grow-0 flex-shrink-0 w-auto">
                  <option value="10" selected>10 chiffres</option>
                  <option value="16">16 chiffres</option>
                </select>
                <input type="tel" pattern="\d*" class="form-control" id="${fieldName}" placeholder="xxxxxxxxxx"
                  ${ifRequired} minlength="10" maxlength="10">
                <div class="invalid-feedback"></div>
              </div>
            </div>
          `;
          break;

        case 'file':
          content = `
            <div class="col-12 col-lg-6 mb-3">
              <label for="${fieldName}" class="form-label">${fieldData.label}</label>
              <input type="file" class="form-control" id="${fieldName}" ${ifRequired}>
              <div class="invalid-feedback"></div>
              <div class="form-text update-file-helper">
                Si vous ignorez ce champs, l'ancien fichier sera maintenu
              </div>
            </div>
          `;
          break;
      }

      blockSubmit.before(content);
    }
  }
}

function getFee(amount = null, cardType = '') {
  for (let step of opType.fees[cardType]) {
    if (step.breakpoint === '' || amount <= parseFloat(step.breakpoint)) {
      if (/^\d+$/.test(step.value)) {
        let value = parseInt(step.value);

        if (amount === null) {
          return [0, value];
        } else {
          return [amount - value, value];
        }
      } else {
        let fees = parseInt(
          (amount * parseFloat(step.value.replace(',', '.'))) / 100
        );
        return [amount - fees, fees];
      }
    }
  }

  return [amount, 0];
}

function getCommission(amount, cardType = '') {
  for (let step of opType.commissions[cardType]) {
    if (step.breakpoint === '' || amount <= parseFloat(step.breakpoint)) {
      if (/^\d+$/.test(step.value)) {
        return parseInt(step.value);
      } else {
        return parseInt(
          (amount * parseFloat(step.value.replace(',', '.'))) / 100
        );
      }
    }
  }

  return 0;
}

function updateFeeAndCommission(amount = null) {
  amount = amount === null ? null : parseInt(amount);

  let newAmount, fee, commission;
  const cardType = $('#card_type').val() || '';

  if (hasCommissions(USER.master, opType.id, cardType)) {
    [newAmount, fee] = getFee(amount, cardType);
    commission = getCommission(amount, cardType);
  } else {
    if (opType.code === 'card_recharge') {
      fee = 0;
    } else {
      fee = amount <= 500000 ? 100 : 200;
    }

    newAmount = amount < fee ? 0 : amount - fee;
    commission = 0;
  }

  $('#opAmount').html(formatAmount(newAmount));
  $('#opFee').html(formatAmount(fee));
  $('#opTotalAmount').html(formatAmount(newAmount + fee));
  $('#opCommission').html(formatAmount(commission));
}

async function otherInits() {
  let countries = null;
  const templateCountry = (country) => {
    if (!country.id) {
      return country.text;
    }

    return $(
      `<img src="${getCountryFlagUrl(country.code)}"> <span>${
        country.name
      }</span>`
    );
  };

  for (const [fieldName, fieldData] of opType.sorted_fields) {
    switch (fieldData.type) {
      case 'country':
        if (countries === null) {
          countries = (
            await ajax({
              url: `${API_BASEURL}/countries`,
              type: 'GET',
            })
          ).data;

          countries.forEach((country) => (country.text = country.name));
        }

        $(`#${fieldName}`).select2({
          data: countries,
          theme: 'bootstrap-5',
          placeholder: 'Select a country',
          allowClear: true,
          templateResult: templateCountry,
          templateSelection: templateCountry,
        });
        break;

      case 'card':
        $(`#${fieldName}_digits`).change(function () {
          let digits = parseInt($(this).val());
          let length = digits === 10 ? 10 : 19;

          $(`#${fieldName}`)
            .prop({
              minlength: length,
              maxlength: length,
              placeholder: digits === 10 ? 'xxxxxxxxxx' : 'xxxx xxxx xxxx xxxx',
            })
            .trigger('input');
        });

        $(`#${fieldName}`).on('input', function () {
          let value = $(this).val().replace(/\D/g, '');
          let digits = $(this).prop('maxlength');

          if (digits === 10) {
            value = value.substring(0, 10);
          } else if (digits === 19) {
            if (value) {
              value = value.match(/.{1,4}/g).join(' ');
            }
          }

          $(this).val(value);
        });
        break;

      default:
        break;
    }
  }

  // When card_type changes, recompute the commissions
  $('#card_type').change(function (e) {
    if (opType.amount_field) {
      updateFeeAndCommission($(`#${opType.amount_field}`).val() || 0);
    }
  });

  // account_recharge special actions

  if (opType.code === 'account_recharge') {
    $('#sender_phone_number_type')
      .change(async function () {
        $(this).val() === 'Autres'
          ? $('#other_type').parent().show()
          : $('#other_type').parent().hide();
      })
      .change();
  }

  // card_activation special actions

  if (opType.code === 'card_activation') {
    $('#card_id').change(async function () {
      try {
        let { data } = await ajax({
          url: `${API_BASEURL}/cards/fetch-by-card-id/${$(this).val()}`,
          type: 'GET',
        });

        $('#uba_type').val(data.category.name);
      } catch ({ error }) {
        console.log(error);
      }
    });
  }

  // card_recharge special actions

  if (opType.code === 'card_recharge') {
    if (object && USER.hasRole('reviewer')) {
      for (const [fieldName, fieldData] of opType.sorted_fields) {
        if (
          ['card_id', 'client_first_name', 'client_last_name'].includes(
            fieldName
          ) === false
        ) {
          $('#' + fieldName)
            .parent()
            .hide();
        }
      }

      $('#card_id').prop('disabled', true);
      $('#card_id_digits').prop('disabled', true);
    }

    $('#card_id').change(async function () {
      try {
        let { data } = await ajax({
          url: `${API_BASEURL}/card-holders/fetch/${$(this).val()}`,
          type: 'GET',
        });

        $('#card_type').val(data.card_type);
        $('#uba_type').val(data.uba_type);
        $('#card_four_digits').val(data.card_four_digits);
        $('#client_first_name').val(data.client_first_name);
        $('#client_last_name').val(data.client_last_name);
      } catch ({ error }) {
        console.log(error);
        // $('#card_type').val('');
        // $('#uba_type').val('');
        // $('#card_four_digits').val('');
        // $('#client_first_name').val('');
        // $('#client_last_name').val('');
      }
    });
  }

  // canal_resub special actions

  if (opType.code === 'canal_resub') {
    $('#formula').change(async function () {
      const match = $(this)
        .val()
        .match(/\((\d+)\)/);
      const amount = parseInt(match[1]);

      $('#amount')
        .val(amount)
        .prop('disabled', amount !== 0)
        .keyup();
    });
  }

  $('#form').submit(function (e) {
    e.preventDefault();
    object ? updateObject() : createObject();
  });

  if (['account_recharge', 'balance_withdrawal'].includes(opType.code)) {
    $('#blockCommissions').hide();
  } else {
    if (opType.amount_field) {
      $(`#${opType.amount_field}`).keyup(function () {
        updateFeeAndCommission($(this).val() || 0);
      });
    } else {
      updateFeeAndCommission(0);
    }
  }

  setTitle(
    object
      ? `Édition de l'opération ${opType.name} ${object.code}`
      : `Nouvelle opération «${opType.name}»`
  );

  $('#linkList')
    .html(`<i class="fas fa-list"></i> Liste des opérations`)
    .attr('href', `/operations/${opType.code}`);

  object ? setForm() : clearForm();
}

window.render = async function () {
  fetchOpType();
  await fetchObject();
  initFields();
  await otherInits();
  initPartnerSelector();
};
