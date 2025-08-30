let c=null,l=null;function f(){let t=$("#opTypeCode").val();l=SETTINGS.opTypes.find(a=>a.code===t)}async function p(){let t=$("#objectId").val();if(t)try{let{data:a}=await ajax({url:`${API_BASEURL}/operations/${l.code}/fetch/${t}`,type:"GET"});c=a}catch({error:a}){await Swal.fire(a.responseJSON.message,"","error"),location=`/operations/${l.code}`}}function d(){for(const[t,a]of l.sorted_fields)if(a.stored)if(t===l.amount_field)$(`#${t}`).val("0").keyup();else switch(a.type){case"select":case"text":case"textarea":case"email":case"file":case"date":case"datetime":$(`#${t}`).val("");break;case"number":$(`#${t}`).val("0");break;case"card":$(`#${t}`).val(""),$(`#${t}_digits`).val("10").change();break;case"country":$(`#${t}`).val(24).change();break}$(".update-file-helper").hide(),$(".is-invalid").removeClass("is-invalid")}function m(){for(const[t,a]of l.sorted_fields)if(a.updated)if(l.code==="account_recharge"&&t==="trans_amount"&&c.data.sender_phone_number_type==="MomoPay")$(`#${t}`).val(c.data[t]/(1-.005));else if(t===l.amount_field)$(`#${t}`).val(c.data[t]).keyup();else switch(a.type){case"select":case"text":case"textarea":case"email":case"date":case"datetime":case"number":$(`#${t}`).val(c.data[t]);break;case"card":$(`#${t}`).val(c.data[t]),$(`#${t}_digits`).val(c.data[t].length).change();break;case"country":$(`#${t}`).val(c.data[t]).change();break;case"file":$(`#${t}`).val("");break}}async function u(){swalLoading();let t=new FormData;for(const[a,e]of l.sorted_fields)if(e.stored)switch(e.type){case"select":case"text":case"textarea":case"email":case"country":case"date":case"datetime":case"number":t.append(a,$(`#${a}`).val());break;case"card":t.append(a,$(`#${a}`).val().replace(/\D/g,""));break;case"file":t.append(a,$(`#${a}`)[0].files[0]??"");break}try{let{data:a}=await ajax({url:`${API_BASEURL}/operations/${l.code}/store`,type:"POST",contentType:!1,processData:!1,data:t});Toast.fire(a.message,"","success"),d()}catch({error:a}){console.log(a),a.responseJSON.errors&&Swal.close(),showErrors(a.responseJSON)}}async function b(){swalLoading();let t=new FormData;for(const[a,e]of l.sorted_fields)if(e.updated)switch(e.type){case"select":case"text":case"textarea":case"email":case"country":case"date":case"datetime":case"number":t.append(a,$(`#${a}`).val());break;case"card":t.append(a,$(`#${a}`).val().replace(/\D/g,""));break;case"file":t.append(a,$(`#${a}`)[0].files[0]??"");break}try{let{data:a}=await ajax({url:`${API_BASEURL}/operations/${l.code}/update/${c.id}`,type:"POST",contentType:!1,processData:!1,data:t});Toast.fire(a.message,"","success"),location=`/operations/${l.code}/${c.id}`}catch({error:a}){console.log(a),a.responseJSON.errors&&Swal.close(),showErrors(a.responseJSON)}}function v(){const t=$("#blockSubmit");for(const[a,e]of l.sorted_fields)if(e.created||e.updated){let s=null,i=e.required?"required":"";switch(e.type){case"select":s=`
            <div class="col-12 col-lg-6 mb-3">
              <label for="${a}" class="form-label">${e.label}</label>
              <select id="${a}" class="form-select">
                <option value="">--Sélectionnez--</option>
                ${e.options.map(r=>`<option value="${r}">${r}</option>`).join("")}
              </select>
              <div class="invalid-feedback"></div>
            </div>`;break;case"text":case"textarea":let o="";if(e.attributes)for(const r in e.attributes)o+=`${r}="${e.attributes[r]}" `;s=`
            <div class="col-12 col-lg-6 mb-3">
              <label for="${a}" class="form-label">${e.label}</label>
              ${e.type==="text"?`<input type="text" class="form-control" id="${a}" placeholder="${e.label}"
                  ${i} maxlength="191" ${o}></input>`:`<textarea class="form-control" id="${a}" placeholder="${e.label}"
                  ${i} maxlength="1000"></textarea>`}
              <div class="invalid-feedback"></div>
            </div>
          `;break;case"email":s=`
            <div class="col-12 col-lg-6 mb-3">
              <label for="${a}" class="form-label">${e.label}</label>
              <input type="email" class="form-control" id="${a}" placeholder="${e.label}"
                ${i} maxlength="191">
              <div class="invalid-feedback"></div>
            </div>
          `;break;case"country":s=`
            <div class="col-12 col-lg-6 mb-3">
              <label for="${a}" class="form-label">${e.label}</label>
              <select id="${a}" class="form-select" ${i}></select>
              <div class="invalid-feedback"></div>
            </div>
          `;break;case"date":s=`
            <div class="col-12 col-lg-6 mb-3">
              <label for="${a}" class="form-label">${e.label}</label>
              <input type="date" class="form-control" id="${a}" placeholder="${e.label}"
                ${e.lte_today?`max="${moment().format("YYYY-MM-DD")}"`:""} ${i}>
              <div class="invalid-feedback"></div>
            </div>
          `;break;case"datetime":s=`
            <div class="col-12 col-lg-6 mb-3">
              <label for="${a}" class="form-label">${e.label}</label>
              <input type="datetime-local" class="form-control" id="${a}" placeholder="${e.label}"
                ${e.lte_today?`max="${moment().format("YYYY-MM-DD HH:mm:ss")}"`:""} ${i}>
              <div class="invalid-feedback"></div>
              </div>
          `;break;case"number":s=`
            <div class="col-12 col-lg-6 mb-3">
              <label for="${a}" class="form-label">${e.label}</label>
              <input type="number" class="form-control" id="${a}" placeholder="${e.label}" ${i}>
              <div class="invalid-feedback"></div>
            </div>
          `;break;case"card":s=`
            <div class="col-12 col-lg-6 mb-3">
              <label for="${a}" class="form-label">${e.label}</label>
              <div class="input-group mb-3">
                <select id="${a}_digits" class="form-select flex-grow-0 flex-shrink-0 w-auto">
                  <option value="10" selected>10 chiffres</option>
                  <option value="16">16 chiffres</option>
                </select>
                <input type="tel" pattern="d*" class="form-control" id="${a}" placeholder="xxxxxxxxxx"
                  ${i} minlength="10" maxlength="10">
                <div class="invalid-feedback"></div>
              </div>
            </div>
          `;break;case"file":s=`
            <div class="col-12 col-lg-6 mb-3">
              <label for="${a}" class="form-label">${e.label}</label>
              <input type="file" class="form-control" id="${a}" ${i}>
              <div class="invalid-feedback"></div>
              <div class="form-text update-file-helper">
                Si vous ignorez ce champs, l'ancien fichier sera maintenu
              </div>
            </div>
          `;break}t.before(s)}}function h(t=null,a=""){for(let e of l.fees[a])if(e.breakpoint===""||t<=parseFloat(e.breakpoint))if(/^\d+$/.test(e.value)){let s=parseInt(e.value);return t===null?[0,s]:[t-s,s]}else{let s=parseInt(t*parseFloat(e.value.replace(",","."))/100);return[t-s,s]}return[t,0]}function _(t,a=""){for(let e of l.commissions[a])if(e.breakpoint===""||t<=parseFloat(e.breakpoint))return/^\d+$/.test(e.value)?parseInt(e.value):parseInt(t*parseFloat(e.value.replace(",","."))/100);return 0}function n(t=null){t=t===null?null:parseInt(t);let a,e,s;const i=$("#card_type").val()||"";hasCommissions(USER.master,l.id,i)?([a,e]=h(t,i),s=_(t,i)):(l.code==="card_recharge"?e=0:e=t<=5e5?100:200,a=t<e?0:t-e,s=0),$("#opAmount").html(formatAmount(a)),$("#opFee").html(formatAmount(e)),$("#opTotalAmount").html(formatAmount(a+e)),$("#opCommission").html(formatAmount(s))}async function g(){let t=null;const a=e=>e.id?$(`<img src="${getCountryFlagUrl(e.code)}"> <span>${e.name}</span>`):e.text;for(const[e,s]of l.sorted_fields)switch(s.type){case"country":t===null&&(t=(await ajax({url:`${API_BASEURL}/countries`,type:"GET"})).data,t.forEach(i=>i.text=i.name)),$(`#${e}`).select2({data:t,theme:"bootstrap-5",placeholder:"Select a country",allowClear:!0,templateResult:a,templateSelection:a});break;case"card":$(`#${e}_digits`).change(function(){let i=parseInt($(this).val()),o=i===10?10:19;$(`#${e}`).prop({minlength:o,maxlength:o,placeholder:i===10?"xxxxxxxxxx":"xxxx xxxx xxxx xxxx"}).trigger("input")}),$(`#${e}`).on("input",function(){let i=$(this).val().replace(/\D/g,""),o=$(this).prop("maxlength");o===10?i=i.substring(0,10):o===19&&i&&(i=i.match(/.{1,4}/g).join(" ")),$(this).val(i)});break}if($("#card_type").change(function(e){l.amount_field&&n($(`#${l.amount_field}`).val()||0)}),l.code==="account_recharge"&&$("#sender_phone_number_type").change(async function(){$(this).val()==="Autres"?$("#other_type").parent().show():$("#other_type").parent().hide()}).change(),l.code==="card_activation"&&$("#card_id").change(async function(){try{let{data:e}=await ajax({url:`${API_BASEURL}/cards/fetch-by-card-id/${$(this).val()}`,type:"GET"});$("#uba_type").val(e.category.name)}catch({error:e}){console.log(e)}}),l.code==="card_recharge"){if(c&&USER.hasRole("reviewer")){for(const[e,s]of l.sorted_fields)["card_id","client_first_name","client_last_name"].includes(e)===!1&&$("#"+e).parent().hide();$("#card_id").prop("disabled",!0),$("#card_id_digits").prop("disabled",!0)}$("#card_id").change(async function(){try{let{data:e}=await ajax({url:`${API_BASEURL}/card-holders/fetch/${$(this).val()}`,type:"GET"});$("#card_type").val(e.card_type),$("#uba_type").val(e.uba_type),$("#card_four_digits").val(e.card_four_digits),$("#client_first_name").val(e.client_first_name),$("#client_last_name").val(e.client_last_name)}catch({error:e}){console.log(e)}})}l.code==="canal_resub"&&$("#formula").change(async function(){const e=$(this).val().match(/\((\d+)\)/),s=parseInt(e[1]);$("#amount").val(s).prop("disabled",s!==0).keyup()}),$("#form").submit(function(e){e.preventDefault(),c?b():u()}),["account_recharge","balance_withdrawal"].includes(l.code)?$("#blockCommissions").hide():l.amount_field?$(`#${l.amount_field}`).keyup(function(){n($(this).val()||0)}):n(0),setTitle(c?`Édition de l'opération ${l.name} ${c.code}`:`Nouvelle opération «${l.name}»`),$("#linkList").html('<i class="fas fa-list"></i> Liste des opérations').attr("href",`/operations/${l.code}`),c?m():d()}window.render=async function(){f(),await p(),v(),await g()};
