// TODO:
// solo un order por need
// segunda vuelta

/** 
 * Variables globales
 * */ 
var files = new Map(); // Datos de un fichero
var csvResultKO = []; // Resultado guardado para descargar el CSV final de casos KO
var csvResultOK = []; // Resultado guardado para descargar el CSV final de casos OK
var dropState = true; // Estado en que se puede agregar ficheros
var dropState2 = false; // Estado en que se puede agregar ficheros
var codeResult = [];
var segundoInformeId = [];
var segundoInformeAsset = [];

/**
 * Constantes
 */
const VAL_CIQ_SIN_CASE = 0;   // Formalizada sin case wtf "CIQ sin Caso asignado"
const VAL_EXC_EVEREST  = 1;   // "Casos en Everest pendiente de cancelación"
const VAL_BONO_SOCIAL  = 2;   // bonos "Bonos Sociales no generan CIO"
const VAL_PTE_BATCH    = 3;   // Quotes Pending o CIQ Pending "Necesidad pendiente de Batch"
const VAL_DOC_INC      = 11;  // Casos de calidad Documentación pendientes "Tienen casos de documentación pendientes sobre estados inconsistentes"
const VAL_CIO_HERMANOS = 12;  // ya hay CIOs hermanos "Ya hay cios en esta necesidad"** estos a Negocio
const VAL_QUOTE_INC    = 14;  // quote en un estado distino de Closed o CRM_Transfer_Pending "Necesidad con Quote en estado inconsitente" -- ver historicos y si switching esta presente escalar
const VAL_CAL_SIN_QUO  = 18;  // Caso de calidad abierto sin Quote/CIO asignado -- Estos casos a Jony, para que nos digan que hacer.
const VAL_W_TMQ        = 50;  // muchas CIQS "Muchos ciqs en la misma necesidad"
const VAL_W_OK         = 100;

const ficherosV1 = ["CIQ","CIO","HIS","NEQ","CAL","DOC","EXC"];
const ficherosV2 = ["ORD","REC","ATR","EXT","CTR"];

// Validaciones:
let validaciones = [
    {
        priority: VAL_CIQ_SIN_CASE, description: "CIQ sin necesidad",
        validate: function(ciqStatus, ciqh) { return false; } // CIQs mal Cancelar estos casos
    }, {
        priority:VAL_EXC_EVEREST, description: "Casos en Everest pendiente de cancelacion",
        validate: function(ciqStatus, ciqh) { return false; }
    }, {
        priority: VAL_BONO_SOCIAL, description: "Bonos Sociales no generan CIO",
        validate: function(ciqStatus,ciqh) { 
            let bono = ciqh[getKeyCol("ciqBono")].toLowerCase();
            let bonoIncondicional = ciqh[getKeyCol("ciqBonoinCondicional")].toLowerCase();
            return ciqStatus == "Formalized" && bono == "true" && bonoIncondicional == "false"; 
        }
    }, {
        priority: VAL_PTE_BATCH, description: "Necesidad pendiente de Batch",
        validate: function(ciqStatus,ciqh) {  // para los casos Bulk regularizamos nosotros de pending a CMR_T_P
            return ciqStatus == "Pending";    // El resto de casos cancelamos
        }
    }, {
		priority: 4, description: "Caso de Calidad o Documentacion pendiente de finalizar",
        validate: function(ciqStatus,ciqh) {
            let ciqQuoteStatus = ciqh[getKeyCol("ciqQuoteStatus")];
            return ciqStatus == "In Review" && ciqQuoteStatus == "In-Transit"; 
        }
    }, {
		priority: 5, description: "Pendiente formalizar nuevamente tras rechazo de caso de Calidad o Documentacion",
        validate: function(ciqStatus,ciqh) {
            let ciqQuoteStatus = ciqh[getKeyCol("ciqQuoteStatus")];
            return ciqStatus == "Pending_after_BO" && ciqQuoteStatus == "In-Transit"; 
        }
    }, {
		priority: 6, description: "Pendiente formalizar nuevamente tras rechazo de caso de Calidad o Documentacion",
        validate: function(ciqStatus,ciqh) {
            let ciqQuoteStatus = ciqh[getKeyCol("ciqQuoteStatus")];
            return ciqStatus == "Signature_pending" && ciqQuoteStatus == "In-Transit"; 
        }
    }, {
		priority: 7, description: "Pendiente formalizar nuevamente tras rechazo de caso de Calidad o Documentacion",
        validate: function(ciqStatus,ciqh) {
            let ciqQuoteStatus = ciqh[getKeyCol("ciqQuoteStatus")];
            let ciqFlgFormalized = ciqh[getKeyCol("ciqFlgFormalized")].toLowerCase();
            return ciqStatus == "Signed" && ciqQuoteStatus == "In-Transit" && ciqFlgFormalized == "false"; 
        }
    }, {
		priority: 8, description: "Pendiente formalizar con flag inconsitente",
        validate: function(ciqStatus,ciqh) {
            let ciqQuoteStatus = ciqh[getKeyCol("ciqQuoteStatus")];
            return ciqStatus == "Signed" && ciqQuoteStatus == "In-Transit"; 
        }
    }, {
		priority: 9, description: "Tienen casos de calidad pendientes sobre formalizados",
        validate: function(ciqStatus,ciqh) { 
            let ciqCalidad = ciqh[getKeyCol("ciqCalidad")];
            return ciqStatus == "Formalized" && ciqCalidad != "" && ciqCalidad != "Closed" && ciqCalidad != "Resuelto Motivo: Responsable endesa" && 
            ciqCalidad != "Resuelto Motivo: Cancelacion Front" && ciqCalidad != "Resolved"  && 
            ciqCalidad != "Resuelto Motivo: Formalización automática" && ciqCalidad != "Resuelto Motivo: FormalizaciÃ³n automÃ¡tica"; 
        }
    }, {
		priority: 10, description: "Tienen casos de calidad pendientes",
        validate: function(ciqStatus,ciqh) { 
            let ciqCalidad = ciqh[getKeyCol("ciqCalidad")];
            return ciqCalidad != "" && ciqCalidad != "Closed" && ciqCalidad != "Resuelto Motivo: Responsable endesa" && 
            ciqCalidad != "Resuelto Motivo: Cancelacion Front" && ciqCalidad != "Resolved" && 
            ciqCalidad != "Resuelto Motivo: Formalización automática" && ciqCalidad != "Resuelto Motivo: FormalizaciÃ³n automÃ¡tica"; 
        }
    }, {
		priority: VAL_DOC_INC, description: "Tienen casos de documentación pendientes sobre estados inconsitentes",
        validate: function(ciqStatus,ciqh) { return false; }
    }, {
		priority: VAL_CIO_HERMANOS, description: "Ya hay cios en esta necesidad",
        validate: function(ciqStatus,ciqh) { return false; }
    }, {
		priority: 13, description: "Quote con estado distinto de CRM_Transfer_Pending sobre CIO Formalizado",
        validate: function(ciqStatus,ciqh) { 
            let ciqQuoteStatus = ciqh[getKeyCol("ciqQuoteStatus")];
            return ciqStatus == "Formalized" && ciqQuoteStatus != "CRM_Transfer_Pending"; 
        }
    }, {
		priority: VAL_QUOTE_INC, description: "Necesidad con Quote en estado inconsistente",
        validate: function(ciqStatus,ciqh) { return false; }
    }, {
		priority: 15, description: "Proceso de creación de CIO finalizado",
        validate: function(ciqStatus,ciqh) { 
            let ciqFlgSendOrder = ciqh[getKeyCol("ciqFlgSendOrder")].toLowerCase();
            return ciqStatus == "Formalized" && ciqFlgSendOrder != "false"; 
        }
    }, {
		priority: 16, description: "Bonos Sociales de F3A inconsistente",
        validate: function(ciqStatus,ciqh) { 
            // F3A_CI_LKP_Social_Bonus__c, FI_CI_DAT_SocialBonusOK__c
            let bonoF3A = ciqh[getKeyCol("ciqBonoF3A")];
            let bonoIncondicional = ciqh[getKeyCol("ciqBonoF3AOK")];
            return ciqStatus != "Formalized" && bonoF3A != "" && bonoIncondicional == ""; 
        }
    }, {
		priority: 17, description: "Asset mal asociado en movimiento distinto a alta",
        validate: function(ciqStatus,ciqh) { 
            let ciqseltype = ciqh[getKeyCol("ciqseltype")];
            let ciqasset = ciqh[getKeyCol("ciqasset")];
            let ciqorderasset = ciqh[getKeyCol("ciqorderasset")];
            return ciqStatus == "Formalized" && ciqseltype != "A" && (ciqasset == "" || ciqasset != ciqorderasset); 
        }
    }, {
		priority: VAL_CAL_SIN_QUO, description: "Caso de calidad abierto sin Quote/CIO asignado",
        validate: function(ciqStatus,ciqh) { return false; }
    }, {
		priority: 19, description: "RecordTypeId sin informar sobre CI N1",
        validate: function(ciqStatus,ciqh) { 
            let ciqRecordType = ciqh[getKeyCol("ciqRecordType")];
            return ciqStatus == "Formalized" && ciqRecordType == ""; 
        }
    }, {
        priority: 20, description: "AccessChannel distintos entre quote y ciq",
        validate: function(ciqStatus,ciqh) {
            let ciqQuoteAccessChannel = ciqh[getKeyCol("ciqQuoteAccessChannel")];
            let ciqAccessChannel = ciqh[getKeyCol("ciqAccessChannel")];
            return ciqStatus == "Formalized" && ciqQuoteAccessChannel != ciqAccessChannel;
        }
    }, {
		priority: VAL_W_TMQ, description: "Muchos ciqs en la misma necesidad",
        validate: function(ciqStatus,ciqh) { return false; },
    }, {
		priority: 51, description: "Validaciones de CC y CD saltadas",
        validate: function(ciqStatus,ciqh) { 
            let flagValidacionesOK = ciqh[getKeyCol("ciqValidacionesOK")].toLowerCase();
            return ciqStatus == "Formalized" && flagValidacionesOK != "true";
        }
    }, {
		priority: 52, description: "Quote CRM_Transfer_Pending sobre CIQ Cancelled",
        validate: function(ciqStatus,ciqh) { 
            let ciqQuoteStatus = ciqh[getKeyCol("ciqQuoteStatus")];
            return ciqStatus == "Cancelled" && ciqQuoteStatus == "CRM_Transfer_Pending"; 
        }
    }, {
		priority: VAL_W_OK, description: "OK relanzar",
        validate: function(ciqStatus,ciqh) { return true; }
    }
];

// Columnas y valores
let columnDistribution = {
    ciq: [
        {alias: "main", tabla: "Id", req: true},
        {alias: "status", tabla: "NE__Status__c", req: true},
        {alias: "quote", tabla: "FI_CI_LKP_Quote__c", req: true},
        {alias: "quotestatus", tabla: "FI_CI_LKP_Quote__r.NE__Status__c", req: true},
        {alias: "need", tabla: "FI_CI_LKP_Quote__r.Case__c", req: true},
        {alias: "cratedate", tabla: "CreatedDate", req: true},
        {alias: "flgformalized", tabla: "NE__OrderId__r.NE__Quote__r.Case__r.FI_CAS_FLG_Formalized__c", req: true},
        {alias: "flgsendorder", tabla: "NE__OrderId__r.NE__Quote__r.FI_NEQ_FLG_SendOrder__c", req: true},
        {alias: "bono", tabla: "FI_CI_FLG_RenounceSocialBonus__c", req: true},
        {alias: "bonoincondicional", tabla: "FI_CI_FLG_UnconditionalHiringBS__c", req: true},
        {alias: "seltype", tabla: "FI_CI_SEL_Type__c", req: true},
        {alias: "orderasset", tabla: "NE__OrderId__r.NE__Quote__r.FI_NEQ_LKP_Asset__c", req: true},
        {alias: "asset", tabla: "FI_CI_LKP_Asset__c", req: true},
        {alias: "ccreq", tabla: "FI_CI_FLG_Requiere_CC__c", req: false},
        {alias: "ccok", tabla: "FI_CI_FLG_Control_Calidad_OK__c", req: false},
        {alias: "docreq", tabla: "FI_CI_FLG_Control_Doc_Req__c", req: false},
        {alias: "docok", tabla: "FI_CI_FLG_Control_Doc_OK__c", req: false},
        {alias: "cupsreq", tabla: "FI_CI_FLG_Control_Cups_Req__c", req: false},
        {alias: "cupsok", tabla: "FI_CI_FLG_Control_Cups_OK__c", req: false},
        {alias: "validacionesok", tabla: "FI_CI_FLG_Validaciones_OK__c", req: true},
        {alias: "recordtype", tabla: "RecordTypeId", req: true},
        {alias: "assetrecordtype", tabla: "FI_CI_LKP_Asset__r.RecordTypeId", req: true},
        {alias: "assetcatalogitem", tabla: "FI_CI_LKP_Asset__r.NE__CatalogItem__c", req: true},
        {alias: "bonof3a", tabla: "F3A_CI_LKP_Social_Bonus__c", req: true},
        {alias: "bonof3aok", tabla: "FI_CI_DAT_SocialBonusOK__c", req: true},
        {alias: "quoteaccesschannel", tabla: "FI_CI_LKP_Quote__r.Access_channel__c", req: true},
        {alias: "accesschannel", tabla: "FI_CI_SEL_Access_channel__c", req: true},
        {alias: "calidadcase", tabla: "FI_CI_LKP_Quote__r.FI_NEQ_LKP_QaCase__c", req: false},
        {alias: "calidad", tabla: "FI_CI_LKP_Quote__r.FI_NEQ_LKP_QaCase__r.Status", req: true},
        {alias: "calidad", tabla: "FI_CI_LKP_Quote__r.FI_NEQ_LKP_QaCase__r.FI_CAS_SEL_resultado__c", req: false},
        {alias: "enterpiseId", tabla: "NE__AssetItemEnterpriseId__c", req: false}
    ], 
    cio: [
        {alias: "main", tabla: "NE__AssetItemEnterpriseId__c", req: true},
        {alias: "need", tabla: "FI_CI_LKP_Quote__r.Case__c", req: true}
    ],
    his: [ // este es el único caso que no se redimenciona
        {alias: "main", tabla: "FI_CI_LKP_Quote__r.Case__c", req: true},
        {alias: "ci", tabla: "Id", req: true},
        {alias: "hisciq", tabla: "Observaciones historicas ciq", req: true},
        {alias: "hiscase", tabla: "Observaciones historicas case", req: true}
    ],
    neq: [
        {alias: "main", tabla: "Case__c", req: true},
        {alias: "status", tabla: "NE__Status__c", req: true}
    ],
    cal: [
        {alias: "main", tabla: "FI_CAS_LKP_CaseNeed__c", req: true}
    ],
    doc: [
        {alias: "main", tabla: "FI_CAS_LKP_ConfigItem__r.FI_CI_LKP_Quote__r.Case__c", req: true}
    ],
    exc: [
        {alias: "main", tabla: "FI_CI_LKP_Quote__r.Case__c", req: true}
    ]
};

/**
 * Función principal se compone de: 
 * - Validación de entrada y gestión de pagina
 * - Getión de datos (Sort): Las busquedas de datos son con el algoritmo bianrio, lo que obliga a que los datos esten ordenados (Sort)
 * - Revisión de informes
 * - Mostrar resultados en página
 */
function calculate() {
    ////////////// Validación de entrada y gestión de pagina
    // Desactivamos botones:
    document.getElementById("calculateBotton").disabled = true;
    ficherosV1.forEach(function(fchName) {
        document.getElementById(`clean${fchName}`).disabled = true;
    });
    document.getElementById("cleanAll").disabled = true;
    
	dropState = false;
    document.getElementById("getCsvKO").disabled = true;
    document.getElementById("getCsvOK").disabled = true;
	
	// variables locales
    console.log("calculating...");
    var resultado = document.getElementById("resultado");
    resultado.innerHTML = "";
    let cioResult = new Map();
    let conPedido = 0;
    let sinCIO = 0;
    let sinPedido = 0;
    let sinPedidoCasos = 0;
    let masAntigua = "null";

    // Limpia variables golobales
    csvResultKO = [];
    csvResultOK = [];

    // validaciones
    if(!validate(true)) return false;
	
    
    
    ////////////// Getión de datos (Sort)
    var arrCIQ = files.get("fileCIQ");
    var arrCIQCase = arrCIQ.filter(() => true);
    var arrCIO = files.get("fileCIO");
    var arrCIOCase = arrCIO.filter(() => true);
    var arrNEQ = files.get("fileNEQ");
    var arrCAL = files.get("fileCAL");
    var arrDOC = files.get("fileDOC");
    var arrHIS = files.get("fileHIS");
    var arrEXC = files.get("fileEXC");
    
    // Sorts
    console.log("Sort ciq");
    sorter(arrCIQ,getKeyCol("ciq"));
    console.log("Sort ciqneed");
    sorter(arrCIQCase,getKeyCol("ciqneed"));
    console.log("Sort cio");
    sorter(arrCIO,getKeyCol("cio"));
    console.log("Sort cioneed");
    sorter(arrCIOCase,getKeyCol("cioneed"));
    console.log("Sort neq");
    sorter(arrNEQ,getKeyCol("neq"));
    console.log("Sort cal");
    sorter(arrCAL,getKeyCol("cal"));
    console.log("Sort doc");
    sorter(arrDOC,getKeyCol("doc"));
    console.log("Sort his");
    sorter(arrHIS,getKeyCol("his"));
    console.log("Sort exc");
    sorter(arrEXC,getKeyCol("exc"));
    console.log("Sorts FIN");

    
    
    
    ////////////// Revisión de informes
    console.log("Look for cases: INI");
    for(let ciq of arrCIQ) {

        let idCiq = ciq[getKeyCol("ciq")];
        let idCase = ciq[getKeyCol("ciqNeed")];
        let idQuote = ciq[getKeyCol("ciqQuote")];
        let status = ciq[getKeyCol("ciqStatus")];
        let createdDate = ciq[getKeyCol("ciqCrateDate")];
        let asset = ciq[getKeyCol("ciqorderasset")];

        // si es el primer renglon de títulos
        if(idCiq == "Id") {
            var ciqOK = ciq.filter(() => true);
            // Campos extra para los informes
            ciqOK.push("Observaciones automaticas");
            ciqOK.push("Observaciones historicas ciq");
            ciqOK.push("Observaciones historicas case");
            csvResultOK.push(ciqOK.join(","));
            csvResultKO.push(ciqOK.join(","));
            
            continue;
        }

        if(status == "Formalized"){ 
            // Con CIO
            if(buscaId(idCiq,arrCIO,getKeyCol("cio"))){
                conPedido++;
                if(conPedido % 20000 == 0) console.log(conPedido + " pedidos encontrados hasta el momento");
            // Sin CIO
            } else {
                let errorCode = VAL_W_OK;
                let histo=[];
                if(idCase == "") errorCode = VAL_CIQ_SIN_CASE;
                else if(buscaId(idCase,arrEXC,getKeyCol("exc"))) errorCode = VAL_EXC_EVEREST;
                else {
                    // Busca todo lo relacionado al Case
                    let ciqs = buscaArr(idCase,arrCIQCase,getKeyCol("ciqNeed"));
                    let cios = buscaArr(idCase,arrCIOCase,getKeyCol("cioNeed"));
                    let neqs = buscaArr(idCase,arrNEQ,getKeyCol("neq"));
                    let docs = buscaArr(idCase,arrDOC,getKeyCol("DOC"));
                    let hiss = buscaArr(idCase,arrHIS,getKeyCol("his"));
                    let calidad = buscaArr(idCase,arrCAL,getKeyCol("cal"));

                    // Validaciones sonbre ciqs
                    for(var iciq = 0;iciq<ciqs.length;iciq++) {
                        let ciqh =ciqs[iciq];
                        let ciqStatus = ciqh[getKeyCol("ciqStatus")];

                        validaciones.forEach(function(validacion){
                            if(errorCode > validacion.priority && validacion.validate(ciqStatus,ciqh)) {
                                errorCode = validacion.priority;
                            }
                        });

                    }
                    
                    // validaciones del NEQ
                    for(var ineq=0;ineq<neqs.length;ineq++) {
                        let neqLocal =  neqs[ineq];
                        let neqStatus = neqLocal[getKeyCol("neqStatus")];
                        if(neqStatus == "Pending" && errorCode > VAL_PTE_BATCH) errorCode = VAL_PTE_BATCH;
                        else if(neqStatus != "Closed" && neqStatus != "CRM_Transfer_Pending" && errorCode > VAL_QUOTE_INC) errorCode = VAL_QUOTE_INC;
                    }

                    // Otras validaciones
                    if(docs.length > 0 && errorCode > VAL_DOC_INC) errorCode = VAL_DOC_INC;
                    if(ciqs.length > 6 && errorCode > VAL_W_TMQ) errorCode = VAL_W_TMQ;
                    if(cios.length > 0 && errorCode > VAL_CIO_HERMANOS)  errorCode = VAL_CIO_HERMANOS;
                    if(calidad.length > 0 && errorCode > VAL_CAL_SIN_QUO) errorCode = VAL_CAL_SIN_QUO;
                    
                    histo = getHis(hiss,idCiq);
                }

                // obtener la fecha más atigua, sin contar los codigos de negocio que no se espera progresen 0, 1  y 2
                if(createdDate < masAntigua && errorCode != VAL_CIQ_SIN_CASE && errorCode != VAL_EXC_EVEREST && errorCode != VAL_BONO_SOCIAL) masAntigua = createdDate;

                if(errorCode<50) {
                    sinCIO++;
                    var ciqOK = ciq;
                    ciqOK.push(getMensaje(errorCode));
                    ciqOK.push(histo[0]);
                    ciqOK.push(histo[1]);
                    csvResultOK.push(ciqOK.join(","));
                } else {
                    sinPedidoCasos++;
                    var ciqKO = ciq;
                    ciqKO.push(getMensaje(errorCode));
                    ciqKO.push(histo[0]);
                    ciqKO.push(histo[1]);
                    csvResultKO.push(ciqKO.join(","));
                    if (!cioResult.has(idCase)) {
                        sinPedido++;
                        cioResult.set(idCase, idQuote);
                    }
                    // Datos del segundo informe
                    segundoInformeId.push(idCiq);
                    if(asset != "") segundoInformeAsset.push(asset);
                }
            }
        }
    }
    console.log("Look for cases: END");
    
    
    
    
    ////////////// Mostrar resultados en página
    console.log("KO["+sinPedidoCasos+"](Cases["+sinPedido+"]) OK["+sinCIO+"] fecha más antigua["+masAntigua+"]");
    console.log(codeResult);
    resultado.appendChild(parrafo("CIQ registradas: "+ (conPedido + sinPedidoCasos + sinCIO)));
    resultado.appendChild(parrafo("CIQ con CIO: "+ conPedido));
    resultado.appendChild(parrafo("CIQ sin CIO OK: "+ sinCIO));
    resultado.appendChild(parrafo("CIQ sin CIO KO: "+ sinPedidoCasos + " (con Case Repetido:"+sinPedido+")"));
    resultado.appendChild(tablaResultante(cioResult));
    resultado.appendChild(parrafo("Datos para segundo informe"));
    resultado.appendChild(tablaSegundoInforme(segundoInformeId,segundoInformeAsset));

    // reactivamos botones de descarga de CSVs
    document.getElementById("getCsvKO").disabled = false;
    document.getElementById("getCsvOK").disabled = false;

    // activa segunda fase
    dropState2 = true;
    ficherosV2.forEach(function(fchName) {
        document.getElementById(`clean${fchName}`).disabled = false;
    });
}




/**
 * Validación de entrada y gestión de pagina
 * Getión de datos (Sort)
 */
function validate(fase1) {
    let validated = true;
    if(fase1) { 
        ficherosV1.forEach(function(fchName) { 
            if(!files.has(`file${fchName}`)) {
                validated = false;
            }
        });
    } else { 
        ficherosV2.forEach(function(fchName) { 
            if(!files.has(`file${fchName}`)) {
                validated = false;
            }
        });
    }

    if(!validated) {
        ficherosV1.forEach(function(fchName) {
            document.getElementById(`clean${fchName}`).disabled = false;
        });
        document.getElementById("cleanAll").disabled = false;
		dropState = true;
        let res = document.createTextNode("Faltan archivos por subir o aun se estan procesando");
        resultado.appendChild(res);
        return false;
    }
    console.log("Valitations OK");
    return true;
}

function sorter(fileElements,keyCol) {
    let idCol = 0;
    fileElements.sort(function(a,b) {
        // encabezados siempre arriba
        if(a[idCol] == "_") return -1;
        if(b[idCol] == "_") return 1;
        // sort de javascript que el de salesforce va como el culo
        return a[keyCol].toLowerCase().localeCompare(b[keyCol].toLowerCase());
        });	
}




/**
 * Revisión de informes
 */
function getHis(his,idCiq) {
    let msgCiq = "";
    let msgCase = "";
    for(var i=0;i<his.length;i++) {
        var hist = his[i];

        var caseHist = hist.length-1; // buscamos el último informado
        while(hist[caseHist]=="" && caseHist > 0)caseHist--;

        if(i==0) msgCase = hist[caseHist];
        if(hist[getKeyCol("his")]==idCiq) {
            msgCiq = hist[caseHist-1];
            msgCase = hist[caseHist];
        }
    }
    return [msgCiq,msgCase];
}

// función para buscar el id en busqueda binaria, al encontrarlo busca en un arrglo todos los casos
function buscaArr(id,arr,column) {
    if(arr.length == 1) return [];
    
    let mid = binarySearch(id,arr,column, 0, arr.length-1);
    if(mid == -1) return [];

    // buscamos el caso inferior
    var inf=mid;
    inf--;
    while(inf>=0 && arr[inf][column] == id) inf--;
    inf++;

    // buscamos ahora el inferior
    var sup=mid;
    sup++;
    while(sup<arr.length && arr[sup][column] == id) sup++;
    sup--;

    let respuesta = [];
    for(var i=inf;i<=sup;i++){
        respuesta.push(arr[i]);
    }

    return respuesta;
}

// función para buscar el id con busqueda binaria
function buscaId(id,arrCSV,column) {
    return binarySearch(id,arrCSV,column, 0, arrCSV.length-1) > -1;
}

// busqueda binaria recursiva FTW
function binarySearch(id,arrCSV,column, start, end){
    // condición base, no encontrado
    if(start > end) return -1;

    // busqueda de mid y comparación
    let mid = Math.floor((start + end) /2);
    let row = arrCSV[mid];
    var compare = id.toLowerCase().localeCompare(row[column].toLowerCase());
    if(mid==0) compare=1; // mid=0 es el encabezado por eso siempre hay que regresar 1
    
    // encontrado!
    if(compare == 0) return mid;

    // menor que mid
    if(compare < 0) return binarySearch(id,arrCSV,column, start, mid-1);

    // mayor que mid
    return binarySearch(id,arrCSV,column, mid+1, end);
}

// A cada resultado del fichero hay una columna clave de comparación aqui se define ese campo
function getKeyCol(elementId) {
	var eId = elementId.toLowerCase();
    if(eId.startsWith("file")) eId = eId.substring(4);
    var tabla = eId.substring(0,3);
    var campo = "main";
    if(eId.length>3) campo = eId.substring(3);

    var arrTabla=columnDistribution[tabla];
    if(arrTabla == null) throw `getKeyCol[${elementId}] con tabla[${tabla}] desconocida`;

    for(var i=0;i<arrTabla.length;i++) {
        if(arrTabla[i].alias == campo) return i+1; // es importante el +1 pues 0 siempre es "_"
    }

    throw `getKeyCol[${elementId}] con tabla[${tabla}] campo[${campo}] desconocida`;
}


/**
 * Mostrar resultados en página
 * Grupo de funciones y métodos para gestionar y mostrar el resultado final
 */
// funciones de validación y gestión sobre la principal
function getMensaje(errorCode) {
    if(!codeResult[errorCode]) codeResult[errorCode]=0;
    codeResult[errorCode]++;

    let mesage = "Error desconocido";

    validaciones.forEach(function(validacion){
        if(errorCode == validacion.priority) {
            mesage = validacion.description;
        }
    });

    return `[${errorCode}] ${mesage}`;
}

// Gestión de resultado
function tablaResultante(cioResult){
    let table = document.createElement("table");

    // THead
    let thead = table.createTHead();
    let hrow = thead.insertRow();
    hrow.insertCell().appendChild(document.createTextNode("Id"));
    hrow.insertCell().appendChild(document.createTextNode("NE__Status__c"));
    hrow.insertCell().appendChild(document.createTextNode(" "));
    hrow.insertCell().appendChild(document.createTextNode("Id"));
    hrow.insertCell().appendChild(document.createTextNode("NE__Status__c"));
    
    // resto de datos
    let tBody = table.createTBody();
    for (let [caseNumber, idQuote] of cioResult.entries()) {
        let row = tBody.insertRow();
        row.insertCell().appendChild(document.createTextNode(idQuote));
        row.insertCell().appendChild(document.createTextNode("In-Transit")); //In Review
        row.insertCell().appendChild(document.createTextNode(""));
        row.insertCell().appendChild(document.createTextNode(idQuote));
        row.insertCell().appendChild(document.createTextNode("CRM_Transfer_Pending"));
    }
    
    return table;
}

function tablaSegundoInforme(segundoInformeId, segundoInformeAsset) {
    let table = document.createElement("table");

    // THead
    let thead = table.createTHead();
    let hrow = thead.insertRow();
    hrow.insertCell().appendChild(document.createTextNode("Id"));
    hrow.insertCell().appendChild(document.createTextNode(" "));
    hrow.insertCell().appendChild(document.createTextNode("Assets"));
    
    // resto de datos
    let tBody = table.createTBody();
    let idMax = segundoInformeId.length;
    let assetMax = segundoInformeAsset.length;
    let max = Math.max(idMax, assetMax);
    for (var i=0;i<max;i++) {
        let row = tBody.insertRow();
        var idVal = "";
        if(i<idMax) idVal = segundoInformeId[i];
        var assetVal = "";
        if(i<assetMax) assetVal = segundoInformeAsset[i];
        row.insertCell().appendChild(document.createTextNode(idVal));
        row.insertCell().appendChild(document.createTextNode(""));
        row.insertCell().appendChild(document.createTextNode(assetVal));
    }
    
    return table;
}

// regresa un parrafo DOM para agregar a algún otro elemento del DOM con el mensaje de entrada
function parrafo(mensaje) {
    let para = document.createElement("p");
    let res = document.createTextNode(mensaje);
    para.appendChild(res);
    return para;
}

// Crea el CSV ya filtrado
function saveCSVKO() {
    console.log("save csv on KOs");
    
    var text = csvResultKO.join("\n");
    const filename = "CIQFormalizadosSinCIO_KO.csv";

    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    var buttonSelection = document.getElementById("buttonSection");
    buttonSelection.appendChild(element);
    
    element.click();
    buttonSelection.removeChild(element);
}

function saveCSVOK() {
    console.log("save csv on OKs");
    
    var text = csvResultOK.join("\n");
    const filename = "CIQFormalizadosSinCIO_OK.csv";

    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    var buttonSelection = document.getElementById("buttonSection");
    buttonSelection.appendChild(element);
    
    element.click();
    buttonSelection.removeChild(element);
}




/**
 * Gestión de ficheros
 */
function clean(element) {
    let elementId = element.id;
    if(elementId.startsWith("clean")) elementId = elementId.substring(5);

    if(elementId == "All") {
        files.clear();
        ficherosV1.forEach(function(val){
            let element = `file${val}Text`;
            document.getElementById(element).innerHTML= "Drag and drop here...<br><img src='img/doc.png' width='20' height='20' >";
        });
    }
    else {
        files.delete("file"+elementId);
        document.getElementById("file"+elementId+"Text").innerHTML= "Drag and drop here...<br><img src='img/doc.png' width='20' height='20' >";
    }
}

function fileHandler(file,elementId) {
	if(file.name.substr(file.name.length - 4) != ".csv" ) {
        alert("La extensión debe ser .csv");
        return false;
    }
    document.getElementById(elementId+"Text").innerHTML= "LOADING FILE...  <img src='img/rainbow.png' height='20' >";
    fileCSVToArray(file,elementId+"");
    console.log('saving file.name['+file.name+'] on['+elementId+']');
}

//Drop invididual
function dropHandler(ev,element) {
	console.log('File(s) dropped');

    // Prevent default behavior (Prevent file from being opened)
    ev.preventDefault();
    
    // fileCRTText
    let eltxt = element.id.substring(4,6);
    if(ficherosV1.contains(eltxt) && !dropState) { 
        alert("Can't drop after generate process");	
        removeDragData(ev); 
        return false; 
    }
    if(ficherosV2.contains(eltxt) && !dropState2) { 
        alert("Can't drop before generate process");	
        removeDragData(ev); 
        return false; 
    }
	
	
    if (ev.dataTransfer.items) {
        // Use DataTransferItemList interface to access the file(s)
        for(var i = 0;i<ev.dataTransfer.items.length;i++){
            if (ev.dataTransfer.items[i].kind === 'file') {
                var file = ev.dataTransfer.items[i].getAsFile();
                fileHandler(file,element.id);
            }
        }
    // Use DataTransfer interface to access the file(s)
    } else if (ev.dataTransfer.files.length > 0) {
        for(var i = 0;i<ev.dataTransfer.files.length;i++){
            var file = ev.dataTransfer.files[i];
            fileHandler(file,element.id);
        }
    }
	
    // Pass event to removeDragData for cleanup
    removeDragData(ev);
}

// Drop de varios ficheros
function dropHandlerAll(ev,element) {
	console.log('File(s) dropped');

    // Prevent default behavior (Prevent file from being opened)
    ev.preventDefault();
	
    if(element.id=="fileAll" &&!dropState) { 
        alert("Can't drop after generate process");	
        removeDragData(ev); 
        return false; 
    }
    if(element.id=="fileAll2" &&!dropState2) { 
        alert("Can't drop before generate process");	
        removeDragData(ev); 
        return false; 
    }

    if (ev.dataTransfer.items) {
        // Use DataTransferItemList interface to access the file(s)
        for (var i = 0; i < ev.dataTransfer.items.length; i++) {
            if (ev.dataTransfer.items[i].kind === 'file') {
                var file = ev.dataTransfer.items[i].getAsFile();
                let elementId = dafaultElementId(file.name);
                if (elementId == "") continue;
				fileHandler(file,elementId);
            }
        }

    // Use DataTransfer interface to access the file(s)
    } else {
        for (var i = 0; i < ev.dataTransfer.files.length; i++) {
            var file = ev.dataTransfer.files[i];
            let elementId = dafaultElementId(file.name);
            if (elementId == "") continue;
			fileHandler(file,elementId);
        }
    } 

    // Pass event to removeDragData for cleanup
    removeDragData(ev);
}

function dafaultElementId(fileName) {
    if(fileName.substring(fileName.length-4) == ".csv") {
        let filen = fileName.substring(0,fileName.length-4);
        filen = filen.toUpperCase();
        if(ficherosV1.includes(filen)) return `file${filen}`;
    }
	return "";
}

// Cosas del gragAndDrop que hice copy/paste npi que hagan
function dragOverHandler(ev) {
    // Prevent default behavior (Prevent file from being opened)
    ev.preventDefault();
}

function removeDragData(ev) {
    console.log('Removing drag data')

    if (ev.dataTransfer.items) {
        // Use DataTransferItemList interface to remove the drag data
        ev.dataTransfer.items.clear();
    } else {
        // Use DataTransfer interface to remove the drag data
        ev.dataTransfer.clearData();
    }
}

// Aquí convertimos el fichero en texto e inicializamos las variables para trabajar los datos
function fileCSVToArray(file,elementId) {
    console.log("Reading: "+elementId);
    var fr = new FileReader();
	fr.onload = function() {
		document.getElementById(elementId + "Text").innerHTML = "Pocessing... <img src='img/pocessing.png' width='20' height='20' >";
       	
		// el timeout es solo para que pinte los estados
		setTimeout(function () {
			
			var fileText = fr.result;
            console.log("Procesing: "+elementId);
            var arrAnt = files.get(elementId);
            arrAnt = (arrAnt || []);
            var arrprocesado = CSVToArray(fileText,null,elementId, file.name);
            //arrprocesado = reacomoda(arrprocesado, elementId, file.name);
            if(arrAnt.length>0) {
                arrprocesado.shift(); // se quitan los encabezados
                arrprocesado = arrAnt.concat(arrprocesado);
            }
			files.set(elementId,arrprocesado);
			console.log("Done: "+elementId);
			document.getElementById(elementId + "Text").innerHTML = "Last file: "+file.name+"["+arrprocesado.length+"] <img src='img/check.png' width='20' height='20' >";
			
		}, 10);
    }
    fr.readAsText(file); //,"ISO-8859-1");
}

function reacomoda(arrTittles,elementId,filename) {
    if(arrTittles == null || arrTittles.length == 0) return [];
    let eId = elementId.toLowerCase();
    if(eId.startsWith("file")) eId = eId.substring(4);
    let arrCampos = columnDistribution[eId];
    if(arrCampos == null) throw `reacomodaCIQ sin columnDistribution para [${eId}] (original[${elementId}] file[${filename}])`;
    var ordenCampos = [0]; // la columna 0 siempre se mantiene
    for(var i=0;i<arrCampos.length;i++) {
        var encontrado = false;
        let campo = arrCampos[i].tabla;
        for(var j=0;j<arrTittles.length&&!encontrado;j++) {
            var col = arrTittles[j];
            if(col.charAt(0) == '"' && col.charAt(col.length-1) == '"' ) {
                arrTittles[j] = col.substr(1,col.length-2);
            }
            if(campo == arrTittles[j]) {
                encontrado = true;
                ordenCampos.push(j);
            }
        }
        if(!encontrado) throw `Para el fichero[${filename}] no se encuentra la columna[${campo}] en la tabla[${eId}]`;
    }
    return ordenCampos;
}

// donde exista ',' dentro de "" la liamos pero en todos los ejemplos que he visto no.
function CSVToArray(strData, strDelimiter,elementId,filename) {
    strDelimiter = (strDelimiter || ",");
    var arrData1row = strData.split("\r\n");
    var arrData = [];
    var ordenCampos = [];
    for(row of arrData1row){
        var cols = row.split(strDelimiter);
        var colsRe = [];

        if(cols[0] == '_' || cols[0] == '"_"') {
            ordenCampos = reacomoda(cols,elementId,filename);
        }
        
        for(var i=0;i<ordenCampos.length;i++) {
            var pos = ordenCampos[i];
            var valcol = cols[pos];
            if(valcol.charAt(0) == '"' && valcol.charAt(valcol.length-1) == '"' ) {
                valcol = valcol.substr(1,valcol.length-2);
            }
            colsRe.push(valcol);
        }
        
        arrData.push(colsRe);
    }
    return arrData;
}
