function i(){let t=[["Opérations en attente","pending","blue"],["Opérations validées","approved","green"],["Opérations rejetées","rejected","red"]];for(const[s,r,o]of t){let e=$(`<div class="row"><h5>${s}</h5></div>`);for(const a of SETTINGS.opTypes)e.append(`
        <div class="col-12 col-lg-4 col-md-6">
          <div class="card">
            <div class="card-body px-4 py-4">
              <div class="row">
                <div class="col-3 d-flex justify-content-start">
                  <div class="stats-icon ${o} mb-2">
                    <i class="${a.icon_class}"></i>
                  </div>
                </div>
                <div class="col-9">
                  <h6 class="text-muted font-semibold">${a.name}</h6>
                  <h6 class="font-extrabold mb-0" id="${a.code}_${r}">0</h6>
                  <div class="text-end">
                    <a href="/operations/${a.code}/${r}" title="Acceder a la liste"
                      class="card-link btn btn-sm btn-outline-primary"><i class="fas fa-list"></i></a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div> 
      `);e.insertBefore("#otherOps")}}function n(t){let s={pending:0,approved:0,rejected:0};for(const e of SETTINGS.opTypes)for(const a of["pending","approved","rejected"])s[a]+=t[`${e.code}_${a}`];let r={series:[s.pending,s.approved,s.rejected],labels:["En attente","Validées","Rejetées"],colors:["#57caeb","#5ddab4","#ff7976"],chart:{type:"donut",width:"100%",height:"350px"},legend:{position:"bottom"},plotOptions:{pie:{donut:{size:"30%"}}}};new ApexCharts(document.getElementById("chartOperationStatus"),r).render()}async function d(){let{data:t}=await ajax({url:`${API_BASEURL}/collabs/dashboard-data`,type:"GET"});const s=new Intl.NumberFormat("fr-FR");for(const e in t)["to_supply_products","histories","recent_partners"].includes(e)===!1&&$("#"+e).text(s.format(t[e]));let r=$("#tableActivities tbody").empty();for(const e of t.histories)r.append(`
      <tr title="${e.content}">
        <td class="col-12">
          <div class="d-flex align-items-center">
            <div class="avatar avatar-md">
              <img src="${getThumbnailUrl(USER.picture)}">
            </div>
            <p class="font-bold ms-3 mb-0">${e.title}</p>
          </div>
        </td>
      </tr>
    `);let o=$("#recentPartners").empty();for(const e of t.recent_partners)o.append(`
      <div class="recent-message d-flex px-4 py-3">
        <div class="avatar avatar-lg">
          <img src="${getThumbnailUrl(e.user.picture)}">
        </div>
        <div class="name ms-4">
          <h5 class="mb-1">${e.user.first_name+" "+e.user.last_name}</h5>
          <h6 class="text-muted mb-0">${e.user.email}</h6>
        </div>
      </div>
    `);n(t)}window.render=async function(){i(),await d(),$("#dashboardMessage").html(SETTINGS.dashboardMessage)};
