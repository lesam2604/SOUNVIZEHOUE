let i=null,r=null;function f(){let e=$("#opTypeCode").val();r=SETTINGS.opTypes.find(a=>a.code===e)}async function p(){let e=$("#objectId").val();if(e)try{let{data:a}=await ajax({url:`${API_BASEURL}/operations/${r.code}/fetch/${e}`,type:"GET"});i=a}catch({error:a}){await Swal.fire(a.responseJSON.message,"","error"),location=`/operations/${r.code}`}}function d(){for(const[e,a]of r.sorted_fields)if(a.stored)if(e===r.amount_field)$(`#${e}`).val("0").keyup();else switch(a.type){case"select":case"text":case"textarea":case"email":case"file":case"date":case"datetime":$(`#${e}`).val("");break;case"number":$(`#${e}`).val("0");break;case"card":$(`#${e}`).val(""),$(`#${e}_digits`).val("10").change();break;case"country":$(`#${e}`).val(24).change();break}$(".update-file-helper").hide(),$(".is-invalid").removeClass("is-invalid")}function m(){for(const[e,a]of r.sorted_fields)if(a.updated)if(r.code==="account_recharge"&&e==="trans_amount"&&i.data.sender_phone_number_type==="MomoPay")$(`#${e}`).val(i.data[e]/(1-.005));else if(e===r.amount_field)$(`#${e}`).val(i.data[e]).keyup();else switch(a.type){case"select":case"text":case"textarea":case"email":case"date":case"datetime":case"number":$(`#${e}`).val(i.data[e]);break;case"card":$(`#${e}`).val(i.data[e]),$(`#${e}_digits`).val(i.data[e].length).change();break;case"country":$(`#${e}`).val(i.data[e]).change();break;case"file":$(`#${e}`).val("");break}}function u(){try{$("#partnerSelectBlock").show(),$("#partnerId").data("select2")||$("#partnerId").select2({theme:"bootstrap-5",placeholder:"Rechercher un partenaire (code, nom, société)",allowClear:!0,ajax:{transport:function(e,a,t){$.ajax({url:`${API_BASEURL}/partners/fetch-by-term`,type:"GET",data:{term:e.data.term||""},success:a,error:t})},delay:250,processResults:function(e){return{results:(e||[]).map(t=>({id:t.id,text:`${t.code} - ${t.first_name} ${t.last_name}${t.company_name?" ("+t.company_name+")":""}`}))}}}})}catch(e){console.warn("initPartnerSelector error:",e)}}async function b(){swalLoading();let e=new FormData;for(const[a,t]of r.sorted_fields)if(t.stored)switch(t.type){case"select":case"text":case"textarea":case"email":case"country":case"date":case"datetime":case"number":e.append(a,$(`#${a}`).val());break;case"card":e.append(a,$(`#${a}`).val().replace(/\D/g,""));break;case"file":e.append(a,$(`#${a}`)[0].files[0]??"");break}try{let a=`${API_BASEURL}/operations/${r.code}/store`;const t=$("#clientType").val()||"partner",l=$("#partnerId").val();if(t==="partner"){if(!l)return Swal.close(),Toast.fire("Veuillez sélectionner un partenaire","","error");a=`${API_BASEURL}/operations/${r.code}/store-for-partner/${l}`}else e.append("client_full_name",$("#client_full_name").val()||""),e.append("client_phone",$("#client_phone").val()||""),e.append("client_email",$("#client_email").val()||""),e.append("requester_name",$("#requester_name").val()||(USER==null?void 0:USER.full_name)||""),a=`${API_BASEURL}/operations/${r.code}/store-without-partner`;let{data:s}=await ajax({url:a,type:"POST",contentType:!1,processData:!1,data:e});Toast.fire(s.message,"","success"),d()}catch({error:a}){console.log(a),a.responseJSON.errors&&Swal.close(),showErrors(a.responseJSON)}}async function v(){swalLoading();let e=new FormData;for(const[a,t]of r.sorted_fields)if(t.updated)switch(t.type){case"select":case"text":case"textarea":case"email":case"country":case"date":case"datetime":case"number":e.append(a,$(`#${a}`).val());break;case"card":e.append(a,$(`#${a}`).val().replace(/\D/g,""));break;case"file":e.append(a,$(`#${a}`)[0].files[0]??"");break}try{let{data:a}=await ajax({url:`${API_BASEURL}/operations/${r.code}/update/${i.id}`,type:"POST",contentType:!1,processData:!1,data:e});Toast.fire(a.message,"","success"),location=`/operations/${r.code}/${i.id}`}catch({error:a}){console.log(a),a.responseJSON.errors&&Swal.close(),showErrors(a.responseJSON)}}function h(){const e=$("#blockSubmit");for(const[a,t]of r.sorted_fields)if(t.created||t.updated){let l=null,s=t.required?"required":"";switch(t.type){case"select":l=`
            <div class="col-12 col-lg-6 mb-3">
              <label for="${a}" class="form-label">${t.label}</label>
              <select id="${a}" class="form-select">
                <option value="">--Sélectionnez--</option>
                ${t.options.map(o=>`<option value="${o}">${o}</option>`).join("")}
              </select>
              <div class="invalid-feedback"></div>
            </div>`;break;case"text":case"textarea":let c="";if(t.attributes)for(const o in t.attributes)c+=`${o}="${t.attributes[o]}" `;l=`
            <div class="col-12 col-lg-6 mb-3">
              <label for="${a}" class="form-label">${t.label}</label>
              ${t.type==="text"?`<input type="text" class="form-control" id="${a}" placeholder="${t.label}"
                  ${s} maxlength="191" ${c}></input>`:`<textarea class="form-control" id="${a}" placeholder="${t.label}"
                  ${s} maxlength="1000"></textarea>`}
              <div class="invalid-feedback"></div>
            </div>
          `;break;case"email":l=`
            <div class="col-12 col-lg-6 mb-3">
              <label for="${a}" class="form-label">${t.label}</label>
              <input type="email" class="form-control" id="${a}" placeholder="${t.label}"
                ${s} maxlength="191">
              <div class="invalid-feedback"></div>
            </div>
          `;break;case"country":l=`
            <div class="col-12 col-lg-6 mb-3">
              <label for="${a}" class="form-label">${t.label}</label>
              <select id="${a}" class="form-select" ${s}></select>
              <div class="invalid-feedback"></div>
            </div>
          `;break;case"date":l=`
            <div class="col-12 col-lg-6 mb-3">
              <label for="${a}" class="form-label">${t.label}</label>
              <input type="date" class="form-control" id="${a}" placeholder="${t.label}"
                ${t.lte_today?`max="${moment().format("YYYY-MM-DD")}"`:""} ${s}>
              <div class="invalid-feedback"></div>
            </div>
          `;break;case"datetime":l=`
            <div class="col-12 col-lg-6 mb-3">
              <label for="${a}" class="form-label">${t.label}</label>
              <input type="datetime-local" class="form-control" id="${a}" placeholder="${t.label}"
                ${t.lte_today?`max="${moment().format("YYYY-MM-DD HH:mm:ss")}"`:""} ${s}>
              <div class="invalid-feedback"></div>
              </div>
          `;break;case"number":l=`
            <div class="col-12 col-lg-6 mb-3">
              <label for="${a}" class="form-label">${t.label}</label>
              <input type="number" class="form-control" id="${a}" placeholder="${t.label}" ${s}>
              <div class="invalid-feedback"></div>
            </div>
          `;break;case"card":l=`
            <div class="col-12 col-lg-6 mb-3">
              <label for="${a}" class="form-label">${t.label}</label>
              <div class="input-group mb-3">
                <select id="${a}_digits" class="form-select flex-grow-0 flex-shrink-0 w-auto">
                  <option value="10" selected>10 chiffres</option>
                  <option value="16">16 chiffres</option>
                </select>
                <input type="tel" pattern="d*" class="form-control" id="${a}" placeholder="xxxxxxxxxx"
                  ${s} minlength="10" maxlength="10">
                <div class="invalid-feedback"></div>
              </div>
            </div>
          `;break;case"file":l=`
            <div class="col-12 col-lg-6 mb-3">
              <label for="${a}" class="form-label">${t.label}</label>
              <input type="file" class="form-control" id="${a}" ${s}>
              <div class="invalid-feedback"></div>
              <div class="form-text update-file-helper">
                Si vous ignorez ce champs, l'ancien fichier sera maintenu
              </div>
            </div>
          `;break}e.before(l)}}function _(e=null,a=""){for(let t of r.fees[a])if(t.breakpoint===""||e<=parseFloat(t.breakpoint))if(/^\d+$/.test(t.value)){let l=parseInt(t.value);return e===null?[0,l]:[e-l,l]}else{let l=parseInt(e*parseFloat(t.value.replace(",","."))/100);return[e-l,l]}return[e,0]}function y(e,a=""){for(let t of r.commissions[a])if(t.breakpoint===""||e<=parseFloat(t.breakpoint))return/^\d+$/.test(t.value)?parseInt(t.value):parseInt(e*parseFloat(t.value.replace(",","."))/100);return 0}function n(e=null){e=e===null?null:parseInt(e);let a,t,l;const s=$("#card_type").val()||"";hasCommissions(USER.master,r.id,s)?([a,t]=_(e,s),l=y(e,s)):(r.code==="card_recharge"?t=0:t=e<=5e5?100:200,a=e<t?0:e-t,l=0),$("#opAmount").html(formatAmount(a)),$("#opFee").html(formatAmount(t)),$("#opTotalAmount").html(formatAmount(a+t)),$("#opCommission").html(formatAmount(l))}async function g(){let e=null;const a=l=>l.id?$(`<img src="${getCountryFlagUrl(l.code)}"> <span>${l.name}</span>`):l.text;for(const[l,s]of r.sorted_fields)switch(s.type){case"country":e===null&&(e=(await ajax({url:`${API_BASEURL}/countries`,type:"GET"})).data,e.forEach(c=>c.text=c.name)),$(`#${l}`).select2({data:e,theme:"bootstrap-5",placeholder:"Select a country",allowClear:!0,templateResult:a,templateSelection:a});break;case"card":$(`#${l}_digits`).change(function(){let c=parseInt($(this).val()),o=c===10?10:19;$(`#${l}`).prop({minlength:o,maxlength:o,placeholder:c===10?"xxxxxxxxxx":"xxxx xxxx xxxx xxxx"}).trigger("input")}),$(`#${l}`).on("input",function(){let c=$(this).val().replace(/\D/g,""),o=$(this).prop("maxlength");o===10?c=c.substring(0,10):o===19&&c&&(c=c.match(/.{1,4}/g).join(" ")),$(this).val(c)});break}if($("#card_type").change(function(l){r.amount_field&&n($(`#${r.amount_field}`).val()||0)}),r.code==="account_recharge"&&$("#sender_phone_number_type").change(async function(){$(this).val()==="Autres"?$("#other_type").parent().show():$("#other_type").parent().hide()}).change(),r.code==="card_activation"&&$("#card_id").change(async function(){try{let{data:l}=await ajax({url:`${API_BASEURL}/cards/fetch-by-card-id/${$(this).val()}`,type:"GET"});$("#uba_type").val(l.category.name)}catch({error:l}){console.log(l)}}),r.code==="card_recharge"){if(i&&USER.hasRole("reviewer")){for(const[l,s]of r.sorted_fields)["card_id","client_first_name","client_last_name"].includes(l)===!1&&$("#"+l).parent().hide();$("#card_id").prop("disabled",!0),$("#card_id_digits").prop("disabled",!0)}$("#card_id").change(async function(){try{let{data:l}=await ajax({url:`${API_BASEURL}/card-holders/fetch/${$(this).val()}`,type:"GET"});$("#card_type").val(l.card_type),$("#uba_type").val(l.uba_type),$("#card_four_digits").val(l.card_four_digits),$("#client_first_name").val(l.client_first_name),$("#client_last_name").val(l.client_last_name)}catch({error:l}){console.log(l)}})}r.code==="canal_resub"&&$("#formula").change(async function(){const l=$(this).val().match(/\((\d+)\)/),s=parseInt(l[1]);$("#amount").val(s).prop("disabled",s!==0).keyup()}),$("#form").submit(function(l){l.preventDefault(),i?v():b()});const t=()=>{const l=$("#clientType").val();!l||l==="partner"?($("#partnerSelectBlock").show(),$("#manualClientBlock").hide()):($("#partnerSelectBlock").hide(),!$("#requester_name").val()&&USER&&USER.full_name&&$("#requester_name").val(USER.full_name),$("#manualClientBlock").show(),$("#partnerId").val("").change())};$("#clientType").on("change",t),t(),["account_recharge","balance_withdrawal"].includes(r.code)?$("#blockCommissions").hide():r.amount_field?$(`#${r.amount_field}`).keyup(function(){n($(this).val()||0)}):n(0),setTitle(i?`Édition de l'opération ${r.name} ${i.code}`:`Nouvelle opération «${r.name}»`),$("#linkList").html('<i class="fas fa-list"></i> Liste des opérations').attr("href",`/operations/${r.code}`),i?m():d()}window.render=async function(){f(),await p(),h(),u(),await g();const e=$("#clientType");(e.length===0||(e.val()||"partner")==="partner")&&$("#partnerSelectBlock").show()};
