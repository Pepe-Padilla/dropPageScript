// TODO:
// caso 4 puede ser por:
// - calidad
// - documentación
// - por bono F3A  -- F3A_CI_LKP_Social_Bonus__c, FI_CI_DAT_SocialBonusOK__c si lo tiene es que tiene gestión de bono social
// - por cups
// nuevo caso FI_CI_SEL_Access_channel__c == FI_CI_LKP_Quote__r.Access_channel__c tienen que ser iguales

// Variables globales
var files = new Map(); // Datos de un fichero
var csvResultKO = []; // Resultado guardado para descargar el CSV final de casos KO
var csvResultOK = []; // Resultado guardado para descargar el CSV final de casos OK
var dropState = true; // Estado en que se puede agregar ficheros
var codeResult = [];
var segundoInformeId = [];
var segundoInformeAsset = [];

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

// VAlidaciones:
let validaciones = [
    {
        priority: VAL_CIQ_SIN_CASE,
        validate: function(ciqStatus, ciqh) { return false; },
        description: "CIQ sin Caso asignado",
        negocio: false,
        ficheroOK: true
    }, {
        priority:VAL_EXC_EVEREST,
        validate: function(ciqStatus, ciqh) { return false; },
        description: "Casos en Everest pendiente de cancelacion",
        negocio: true,
        ficheroOK: true
    }, {
        priority: VAL_BONO_SOCIAL,
        validate: function(ciqStatus,ciqh) { 
            let bono = ciqh[getKeyCol("ciqBono")].toLowerCase();
            let bonoIncondicional = ciqh[getKeyCol("ciqBonoinCondicional")].toLowerCase();
            return ciqStatus == "Formalized" && bono == "true" && bonoIncondicional == "false"; 
        },
        description: "Casos en Everest pendiente de cancelacion",
        negocio: true,
        ficheroOK: true
    }, {
        priority: VAL_PTE_BATCH,
        validate: function(ciqStatus,ciqh) { 
            return ciqStatus == "Pending"; 
        },
        description: "Bonos Sociales no generan CIO",
        negocio: true,
        ficheroOK: true
    }, {
		priority: 4,
        validate: function(ciqStatus,ciqh) { 
            let ciqQuoteStatus = ciqh[getKeyCol("ciqQuoteStatus")];
            return ciqStatus == "In Review" && ciqQuoteStatus == "In-Transit"; 
        },
        description: "Caso de Calidad o Documentacion pendiente de finalizar",
        negocio: true,
        ficheroOK: true
    }, {
		priority: 5,
        validate: function(ciqStatus,ciqh) {
            let ciqQuoteStatus = ciqh[getKeyCol("ciqQuoteStatus")];
            return ciqStatus == "Pending_after_BO" && ciqQuoteStatus == "In-Transit"; 
        },
        description: "Pendiente formalizar nuevamente tras rechazo de caso de Calidad o Documentacion",
        negocio: true,
        ficheroOK: true
    }, {
		priority: 6,
        validate: function(ciqStatus,ciqh) {
            let ciqQuoteStatus = ciqh[getKeyCol("ciqQuoteStatus")];
            return ciqStatus == "Signature_pending" && ciqQuoteStatus == "In-Transit"; 
        },
        description: "Pendiente formalizar nuevamente tras rechazo de caso de Calidad o Documentacion",
        negocio: true,
        ficheroOK: true
    }, {
		priority: 7,
        validate: function(ciqStatus,ciqh) {
            let ciqQuoteStatus = ciqh[getKeyCol("ciqQuoteStatus")];
            return ciqStatus == "Signed" && ciqQuoteStatus == "In-Transit" && ciqFlgFormalized == "false"; 
        },
        description: "Pendiente formalizar nuevamente tras rechazo de caso de Calidad o Documentacion",
        negocio: true,
        ficheroOK: true
    }, {
		priority: 8,
        validate: function(ciqStatus,ciqh) {
            let ciqQuoteStatus = ciqh[getKeyCol("ciqQuoteStatus")];
            return ciqStatus == "Signed" && ciqQuoteStatus == "In-Transit"; 
        },
        description: "Pendiente formalizar con flag inconsitente",
        negocio: false,
        ficheroOK: true
    }, {
		priority: 9,
        validate: function(ciqStatus,ciqh) { 
            let ciqCalidad = ciqh[getKeyCol("ciqCalidad")];
            return ciqStatus == "Formalized" && ciqCalidad != "" && ciqCalidad != "Closed" && ciqCalidad != "Resuelto Motivo: Responsable endesa" && 
            ciqCalidad != "Resuelto Motivo: Cancelacion Front" && ciqCalidad != "Resolved"  && 
            ciqCalidad != "Resuelto Motivo: Formalización automática" && ciqCalidad != "Resuelto Motivo: FormalizaciÃ³n automÃ¡tica"; 
        },
        description: "Tienen casos de calidad pendientes sobre formalizados",
        negocio: true,
        ficheroOK: true
    }, {
		priority: 10,
        validate: function(ciqStatus,ciqh) { 
            let ciqCalidad = ciqh[getKeyCol("ciqCalidad")];
            return ciqCalidad != "" && ciqCalidad != "Closed" && ciqCalidad != "Resuelto Motivo: Responsable endesa" && 
            ciqCalidad != "Resuelto Motivo: Cancelacion Front" && ciqCalidad != "Resolved" && 
            ciqCalidad != "Resuelto Motivo: Formalización automática" && ciqCalidad != "Resuelto Motivo: FormalizaciÃ³n automÃ¡tica"; 
        },
        description: "Tienen casos de calidad pendientes",
        negocio: false,
        ficheroOK: true
    }, {
		priority: VAL_DOC_INC,
        validate: function(ciqStatus,ciqh) { 
            return false; 
        },
        description: "Tienen casos de documentación pendientes sobre estados inconsitentes",
        negocio: false,
        ficheroOK: true
    }, {
		priority: VAL_CIO_HERMANOS,
        validate: function(ciqStatus,ciqh) { 
            return false; 
        },
        description: "Ya hay cios en esta necesidad",
        negocio: false,
        ficheroOK: true
    }, {
		priority: 13,
        validate: function(ciqStatus,ciqh) { 
            let ciqQuoteStatus = ciqh[getKeyCol("ciqQuoteStatus")];
            return ciqStatus == "Formalized" && ciqQuoteStatus != "CRM_Transfer_Pending"; 
        },
        description: "Quote con estado distinto de CRM_Transfer_Pending sobre CIO Formalizado",
        negocio: false,
        ficheroOK: true
    }, {
		priority: VAL_QUOTE_INC,
        validate: function(ciqStatus,ciqh) { 
            return false; 
        },
        description: "Necesidad con Quote en estado inconsistente",
        negocio: false,
        ficheroOK: true
    }, {
		priority: 15,
        validate: function(ciqStatus,ciqh) { 
            let ciqFlgSendOrder = ciqh[getKeyCol("ciqFlgSendOrder")].toLowerCase();
            return ciqStatus == "Formalized" && ciqFlgSendOrder != "false"; 
        },
        description: "Proceso de creación de CIO finalizado",
        negocio: false,
        ficheroOK: true
    }, {
		priority: 16,
        validate: function(ciqStatus,ciqh) { 
            let bono = ciqh[getKeyCol("ciqBono")].toLowerCase();
            let bonoIncondicional = ciqh[getKeyCol("ciqBonoinCondicional")].toLowerCase();
            return ciqStatus != "Formalized" && bono == "true" && bonoIncondicional == "true"; 
        },
        description: "Bonos Sociales no generan CIO sobre no formalizados",
        negocio: false,
        ficheroOK: true
    }, {
		priority: 17,
        validate: function(ciqStatus,ciqh) { 
            let ciqseltype = ciqh[getKeyCol("ciqseltype")];
            let ciqasset = ciqh[getKeyCol("ciqasset")];
            let ciqorderasset = ciqh[getKeyCol("ciqorderasset")];
            return ciqStatus == "Formalized" && ciqseltype != "A" && (ciqasset == "" || ciqasset != ciqorderasset); 
        },
        description: "Asset mal asociado en movimiento distinto a alta",
        negocio: false,
        ficheroOK: true
    }, {
		priority: VAL_CAL_SIN_QUO,
        validate: function(ciqStatus,ciqh) { 
            return false; 
        },
        description: "Caso de calidad abierto sin Quote/CIO asignado",
        negocio: true,
        ficheroOK: true
    }, {
		priority: 19,
        validate: function(ciqStatus,ciqh) { 
            let ciqRecordTypeId = ciqh[getKeyCol("ciqRecordTypeId")];
            return ciqStatus == "Formalized" && ciqRecordTypeId == ""; 
        },
        description: "RecordTypeId sin informar sobre CI N1",
        negocio: false,
        ficheroOK: true
    }, {
		priority: VAL_W_TMQ,
        validate: function(ciqStatus,ciqh) { 
            return false; 
        },
        description: "Muchos ciqs en la misma necesidad",
        negocio: false,
        ficheroOK: false
    }, {
		priority: 51,
        validate: function(ciqStatus,ciqh) { 
            let flagValidacionesOK = ciqh[getKeyCol("ciqValidacionesOK")].toLowerCase();
            return ciqStatus == "Formalized" && flagValidacionesOK != "true";
        },
        description: "Validaciones de CC y CD saltadas",
        negocio: false,
        ficheroOK: false
    }, {
		priority: 52,
        validate: function(ciqStatus,ciqh) { 
            let ciqQuoteStatus = ciqh[getKeyCol("ciqQuoteStatus")];
            return ciqStatus == "Cancelled" && ciqQuoteStatus == "CRM_Transfer_Pending"; 
        },
        description: "Quote CRM_Transfer_Pending sobre CIQ Cancelled",
        negocio: false,
        ficheroOK: false
    }, {
		priority: VAL_W_OK,
        validate: function(ciqStatus,ciqh) { 
            return true; 
        },
        description: "OK relanzar",
        negocio: false,
        ficheroOK: false
    }
];

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
	
	if(!dropState) { alert("Can't drop afer generate process");	removeDragData(ev); return false; }
	
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
function dropHandlerAll(ev) {
	console.log('File(s) dropped');

    // Prevent default behavior (Prevent file from being opened)
    ev.preventDefault();
	
    if(!dropState) { alert("Can't drop files in this state, you have to refresh the page");	removeDragData(ev); return false; }

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
    if(fileName.substring(str.length-4) == ".csv") {
        let filen = fileName.substring(0,str.length-4);
        filen = filen.toUpperCase();
        if(ficherosV1.includes(filen)) return `file${filen}`;
    }
	return "";
}

function sorter(fileElements,keyCol) {
    let idCol = 1;
    fileElements.sort(function(a,b) {
        // encabezados siempre arriba
        if(a[idCol] == "Id") return -1;
        if(b[idCol] == "Id") return 1;
        // sort de javascript que el de salesforce va como el culo
        return a[keyCol].toLowerCase().localeCompare(b[keyCol].toLowerCase());
        });	
}

function validate(){
    let validated = true;
    ficherosV1.forEach(function(fchName) {
        if(!files.has(`file${fchName}`)) {
            validated = false;
        }
    });

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

// Valida y calcula el resultado
function calculate() {
	// Desactivamos botones
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
    if(!validate()) return false;
	
	// obtenermos la info de los ficheros en variables locales
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
    console.log("Sort ciqcase");
    sorter(arrCIQCase,getKeyCol("ciqcase"));
    console.log("Sort cio");
    sorter(arrCIO,getKeyCol("cio"));
    console.log("Sort ciocase");
    sorter(arrCIOCase,getKeyCol("ciocase"));
    console.log("Sort neq");
    sorter(arrNEQ,getKeyCol("neq"));
    console.log("Sort cal");
    sorter(arrCAL,getKeyCol("cal"));
    console.log("Sort doc");
    sorter(arrDOC,getKeyCol("doc"));
    console.log("Sort his");
    sorter(arrHIS,getKeyCol("ciqcase"));
    console.log("Sort exc");
    sorter(arrEXC,getKeyCol("exc"));
    console.log("Sorts FIN");

    // Va lo bueno
    console.log("Look for cases: INI");
    for(let ciq of arrCIQ) {

        let idCiq = ciq[getKeyCol("ciq")];
        let idCase = ciq[getKeyCol("ciqCase")];
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
                    let ciqs = buscaArr(idCase,arrCIQCase,getKeyCol("ciqcase"));
                    let cios = buscaArr(idCase,arrCIOCase,getKeyCol("ciocase"));
                    let neqs = buscaArr(idCase,arrNEQ,getKeyCol("neq"));
                    let docs = buscaArr(idCase,arrDOC,getKeyCol("DOC"));
                    let hiss = buscaArr(idCase,arrHIS,getKeyCol("ciqcase"));
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
                    
                    histo = geHis(hiss,idCiq);
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
    
    // Desplegamos el resultado
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
}

function getMensaje(errorCode) {
    if(!codeResult[errorCode]) codeResult[errorCode]=0;
    codeResult[errorCode]++;

    validaciones.forEach(function(validacion){
        if(errorCode == validacion.priority) {
            let desc = validacion.description;
            return `[${errorCode}] ${desc}`;
        }
    });

    return `[${errorCode}] Error desconocido`;
}

function getHis(his,idCiq) {
    let msgCiq = "";
    let msgCase = "";
    for(var i=0;i<his.length;i++) {
        var hist = his[i];

        var caseHist = hist.length-1; // buscamos el último informado
        while(hist[caseHist]=="" && caseHist > 0)caseHist--;

        if(i==0) msgCase = hist[caseHist];
        if(hist[getKeyCol("ciq")]==idCiq) {
            msgCiq = hist[caseHist-1];
            msgCase = hist[caseHist];
        }
    }
    return [msgCiq,msgCase];
}

// Arama la tabla con el resultado
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
			var arrprocesado = CSVToArray(fileText,arrAnt);
			files.set(elementId,arrprocesado);
			console.log("Done: "+elementId);
			document.getElementById(elementId + "Text").innerHTML = "Last file: "+file.name+"["+arrprocesado.length+"] <img src='img/check.png' width='20' height='20' >";
			
		}, 10);
    }
    fr.readAsText(file); //,"ISO-8859-1");
}

// A cada resultado del fichero hay una columna clave de comparación aqui se define ese campo
function getKeyCol(elementId) {
	var eId = elementId.toLowerCase();
	if(eId.startsWith("file")) eId = eId.substring(4);
	switch(eId) {
		case "ciq":
        	return 1;
		case "cio":
        case "neq":
        case "cal":
        case "documentacionciqid":
        case "ciqstatus":
            return 2;
        case "ciqquote":
		case "exc":
            return 3;
        case "ciocase":
            return 4;
        case "ciqcase":
            return 5;
        case "neqstatus":
        case "ciqquotestatus":
            return 6;
        case "ciqcratedate":
            return 9;
        case "doc":
            return 11;
        case "ciqflgformalized":
            return 13;
        case "ciqflgsendorder":
            return 14;
        case "ciqorderasset":
            return 15;
        case "ciqbono":
            return 17;
        case "ciqbonoincondicional":
            return 18;
        case "ciqvalidacionesok":
            return 25;
        case "ciqasset":
            return 26;
        case "ciqseltype":
            return 27;
        case "ciqrecordtypeid":
            return 28;
        case "ciqcalidad":
            return 29;
		default:
            throw `getKeyCol[${elementId}] desconocida`;
	}
}

// donde exista ',' dentro de "" la liamos pero en todos los ejemplos que he visto no.
function CSVToArray(strData, arrAnt, strDelimiter) {
    strDelimiter = (strDelimiter || ",");
    arrAnt = (arrAnt || []);
    var arrData1row = strData.split("\r\n");
    var arrData = [];
    for(row of arrData1row){
        var cols = row.split(strDelimiter);
        for(var i = 0;i<cols.length;i++) {
            var col = cols[i];
            if(col.charAt(0) == '"' && col.charAt(col.length-1) == '"' ) {
                cols[i] = col.substr(1,col.length-2);
            }
        }
        arrData.push(cols);
    }
    if(arrAnt.length>0) {
        arrData.shift(); // se quitan los encabezados
        arrData = arrAnt.concat(arrData);
    }
    return arrData;
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
