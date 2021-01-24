// Variables globales
var files = new Map(); // Datos de un fichero
var csvResultKO = []; // Resultado guardado para descargar el CSV final de casos KO
var csvResultOK = []; // Resultado guardado para descargar el CSV final de casos OK
var dropState = true; // Estado en que se puede agregar ficheros
var codeResult = [];
var segundoInformeId = [];
var segundoInformeAsset = [];

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
	
	var file = null;
    if (ev.dataTransfer.items) {
        // Use DataTransferItemList interface to access the file(s)
        if (ev.dataTransfer.items[0].kind === 'file') {
            file = ev.dataTransfer.items[0].getAsFile();
        }
    // Use DataTransfer interface to access the file(s)
    } else if (ev.dataTransfer.files.length > 0) {
        file = ev.dataTransfer.files[0];
    }
	
	fileHandler(file,element.id);
	
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
	let elementId = "";
	if (fileName == "ciq.csv") elementId = "fileCIQ";
    else if (fileName == "cio.csv") elementId = "fileCIO";
    else if (fileName == "neq.csv") elementId = "fileNEQ";
    else if (fileName == "documents.csv") elementId = "fileDocuments";
    else if (fileName == "historico.csv") elementId = "fileHistorico";
    else if (fileName == "exceptions.csv") elementId = "fileExceptions";
	
	return elementId;
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
    if(!files.has("fileCIQ") || !files.has("fileCIO") || !files.has("fileHistorico") || 
    !files.has("fileNEQ") || !files.has("fileDocuments") || !files.has("fileExceptions") ) {
        document.getElementById("calculateBotton").disabled = false;
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
    var arrDocuments = files.get("fileDocuments");
    var arrHistorico = files.get("fileHistorico");
    var arrExceptions = files.get("fileExceptions");
    
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
    console.log("Sort documents");
    sorter(arrDocuments,getKeyCol("documents"));
    console.log("Sort historico");
    sorter(arrHistorico,getKeyCol("ciqcase"));
    console.log("Sort exceptions");
    sorter(arrExceptions,getKeyCol("exceptions"));
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
                let errorCode = 100;
                let histo=[];
                if(idCase == "") errorCode = 0;
                else if(buscaId(idCase,arrExceptions,getKeyCol("exceptions"))) errorCode = 1;
                else {
                    // Busca todo lo relacionado al Case
                    let ciqs = buscaArr(idCase,arrCIQCase,getKeyCol("ciqcase"));
                    let cios = buscaArr(idCase,arrCIOCase,getKeyCol("ciocase"));
                    let neqs = buscaArr(idCase,arrNEQ,getKeyCol("neq"));
                    let documents = buscaArr(idCase,arrDocuments,getKeyCol("documents"));
                    let historicos = buscaArr(idCase,arrHistorico,getKeyCol("ciqcase"));

                    // 0 Formalizada sin case wtf "CIQ sin Caso asignado"
                    // 1 "Casos en Everest pendiente de cancelación"
                    // 2 bonos "Bonos Sociales no generan CIO"
                    // 3 Quotes Pending o CIQ Pending "Necesidad pendiente de Batch"
                    // 4 Calidad/Docs In-Transit In Review "Caso de Calidad o Documentación pendiente de finalizar"
                    // 5 Calidad/Docs In-Transit Pending_after_BO	"Pendiente formalizar neuvamente tras rechazo de caso de Calidad o Documentación"
                    // 6 Calidad/Docs In-Transit Signature_pending "Pendiente formalizar neuvamente tras rechazo de caso de Calidad o Documentación"
                    // 7 Calidad/Docs In-Transit Signed "Pendiente formalizar neuvamente tras rechazo de caso de Calidad o Documentación"
                    // 8 Casos de calidad Pendientes saltados sobre Formalizados "Tienen casos de calidad pendientes sobre formalizados"
                    // 9 Casos de calidad Pendientes saltados sobre Cancelados "Tienen casos de calidad pendientes"
                    // 10 Casos de calidad Documentación pendientes "Tienen casos de documentación pendientes"
                    // 11 ya hay CIOs hermanos "Ya hay cios en esta necesidad"**
                    // 12 Formalized sobre quote no CRM_Transfer_Pending "Quote inconsitente sobre CIQ Formalizado"
                    // 13 quote en un estado distino de Closed o CRM_Transfer_Pending "Necesidad con Quote en estado inconsitente"
                    // 14 FI_NEQ_FLG_SendOrder__c "Proceso de creación de CIO finalizado"
                    // 15 "Bonos Sociales no generan CIO sobre no formalizados"
                    //-- warnings de relanzamiento:
                    // 50 muchas CIQS "Muchos ciqs en la misma necesidad"
                    // 51 FI_CI_FLG_Validaciones_OK__c = false "Validaciones de CC y CD saltadas"
                    // 52 CRM_Transfer_Pending Cancelled "Quote CRM_Transfer_Pending sobre CIQ Cancelled"
                    // 100 OK relanzar "Relanzar"

                    // Validaciones sonbre ciqs
                    for(var iciq = 0;iciq<ciqs.length;iciq++) {
                        let ciqh =ciqs[iciq];

                        // variables
                        let ciqStatus = ciqh[getKeyCol("ciqStatus")];
                        let ciqQuoteStatus = ciqh[getKeyCol("ciqQuoteStatus")];
                        let bono = ciqh[getKeyCol("ciqBono")].toLowerCase();
                        let bonoIncondicional = ciqh[getKeyCol("ciqBonoinCondicional")].toLowerCase();
                        let flagValidacionesOK = ciqh[getKeyCol("ciqValidacionesOK")].toLowerCase();
                        let ciqCalidad = ciqh[getKeyCol("ciqCalidad")];
                        let ciqFlgSendOrder = ciqh[getKeyCol("ciqFlgSendOrder")].toLowerCase();
                        let ciqorderasset = ciqh[getKeyCol("ciqorderasset")];
                        let ciqasset = ciqh[getKeyCol("ciqasset")];
                        let ciqseltype = ciqhgetKeyCol("ciqseltype")

                        if(ciqStatus == "Formalized" && bono == "true" && bonoIncondicional == "false" && errorCode > 2) errorCode = 2;
                        else if(ciqStatus == "Pending" && errorCode > 3) errorCode = 3;
                        else if(ciqStatus == "In Review" && ciqQuoteStatus == "In-Transit" && errorCode > 4) errorCode = 4;
                        else if(ciqStatus == "Pending_after_BO" && ciqQuoteStatus == "In-Transit" && errorCode > 5) errorCode = 5;
                        else if(ciqStatus == "Signature_pending" && ciqQuoteStatus == "In-Transit" && errorCode > 6) errorCode = 6;
                        else if(ciqStatus == "Signed" && ciqQuoteStatus == "In-Transit" && errorCode > 7) errorCode = 7;
                        else if(ciqStatus == "Formalized" && ciqCalidad != "" && ciqCalidad != "Closed" && ciqCalidad != "Resuelto Motivo: Responsable endesa" && 
                        ciqCalidad != "Resuelto Motivo: Cancelacion Front" && ciqCalidad != "Resolved"  && 
						ciqCalidad != "Resuelto Motivo: Formalización automática" && ciqCalidad != "Resuelto Motivo: FormalizaciÃ³n automÃ¡tica" && errorCode > 8) errorCode = 8;
                        else if(ciqCalidad != "" && ciqCalidad != "Closed" && ciqCalidad != "Resuelto Motivo: Responsable endesa" && 
                        ciqCalidad != "Resuelto Motivo: Cancelacion Front" && ciqCalidad != "Resolved" && 
						ciqCalidad != "Resuelto Motivo: Formalización automática" && ciqCalidad != "Resuelto Motivo: FormalizaciÃ³n automÃ¡tica" && errorCode > 9) errorCode = 9;
                        else if(documents.length > 0 && errorCode > 10) errorCode = 10;
                        else if(ciqStatus == "Formalized" && ciqQuoteStatus != "CRM_Transfer_Pending" && errorCode > 12) errorCode = 12;
                        else if(ciqStatus == "Formalized" && ciqFlgSendOrder != "false" && errorCode > 14) errorCode = 14;
                        else if(ciqStatus == "Formalized" && ciqseltype != "A" && (ciqasset == "" || ciqasset != ciqorderasset)) errorCode = 15;
						else if(ciqStatus != "Formalized" && bono == "true" && bonoIncondicional == "false" && errorCode > 15) errorCode = 15;
                        else if(ciqStatus == "Formalized" && flagValidacionesOK != "true" && errorCode > 51) errorCode = 51;
                        else if(ciqStatus == "Cancelled" && ciqQuoteStatus == "CRM_Transfer_Pending" && errorCode > 52) errorCode = 52;
                    }
                    
                    // validaciones del NEQ
                    for(var ineq=0;ineq<neqs.length;ineq++) {
                        let neqLocal =  neqs[ineq];
                        let neqStatus = neqLocal[getKeyCol("neqStatus")];
                        if(neqStatus == "Pending" && errorCode > 3) errorCode = 3;
                        else if(neqStatus != "Closed" && neqStatus != "CRM_Transfer_Pending" && errorCode > 13) errorCode = 13;
                    }

                    // Otras validaciones
                    if(ciqs.length > 6 && errorCode > 50) errorCode = 50;
                    if(cios.length > 0 && errorCode > 11)  errorCode = 11;
                    
                    histo = getHistoricos(historicos,idCiq);
                }

                // obtener la fecha más atigua, sin contar los codigos de negocio que no se espera progresen 0, 1  y 2
                if(createdDate < masAntigua && errorCode != 0 && errorCode != 1 && errorCode != 2) masAntigua = createdDate;

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
                    // Segundo informe
                    segundoInformeId.push(idCiq);
                    if(!segundoInformeAsset.has(asset)) {
                        segundoInformeAsset.push(asset);
                    }
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
    switch(errorCode) {
        case 0:
            return "["+errorCode+"] CIQ sin Caso asignado";
        case 1:
            return "["+errorCode+"] Casos en Everest pendiente de cancelacion";
		case 2:
            return "["+errorCode+"] Bonos Sociales no generan CIO";
        case 3:
            return "["+errorCode+"] Necesidad pendiente de Batch";
        case 4:
            return "["+errorCode+"] Caso de Calidad o Documentacion pendiente de finalizar";
        case 5:
        case 6:
        case 7:
            return "["+errorCode+"] Pendiente formalizar nuevamente tras rechazo de caso de Calidad o Documentacion";
        case 8:
            return "["+errorCode+"] Tienen casos de calidad pendientes sobre formalizados";
        case 9:
            return "["+errorCode+"] Tienen casos de calidad pendientes";
        case 10:
            return "["+errorCode+"] Tienen casos de documentación pendientes";
        case 11:
            return "["+errorCode+"] Ya hay cios en esta necesidad";
        case 12:
            return "["+errorCode+"] Quote con estado distinto de CRM_Transfer_Pending sobre CIO Formalizado";
        case 13:
            return "["+errorCode+"] Necesidad con Quote en estado inconsistente";
        case 14:
            return "["+errorCode+"] Proceso de creación de CIO finalizado";
		case 15:
            return "["+errorCode+"] Bonos Sociales no generan CIO sobre no formalizados";
        case 16:
            return "["+errorCode+"] Asset mal asociado en movimiento distinto a alta";
        case 50:
            return "["+errorCode+"] Muchos ciqs en la misma necesidad";
        case 51:
            return "["+errorCode+"] Validaciones de CC y CD saltadas";
        case 52:
            return "["+errorCode+"] Quote CRM_Transfer_Pending sobre CIQ Cancelled";
        case 100:
            return "["+errorCode+"] OK relanzar";
        default:
            return "["+errorCode+"] Error desconocido";
    }
}

function getHistoricos(historicos,idCiq) {
    let msgCiq = "";
    let msgCase = "";
    for(var i=0;i<historicos.length;i++) {
        var hist = historicos[i];

        var caseHist = hist.length-1; // buscamos el último informado
        while(hist[caseHist]=="")caseHist--;

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
			var arrprocesado = CSVToArray(fileText);
			files.set(elementId,arrprocesado);
			console.log("Done: "+elementId);
			document.getElementById(elementId + "Text").innerHTML = file.name+" <img src='img/check.png' width='20' height='20' >";
			
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
        case "documentacionciqid":
        case "ciqstatus":
            return 2;
        case "ciqquote":
		case "exceptions":
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
        case "documents":
            return 11;
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
        case "ciqcalidad":
            return 28;
		default:
            throw "getKeyCol["+elementId+"] desconocida";
	}
}

// donde exista ',' dentro de "" la liamos pero en todos los ejemplos que he visto no.
function CSVToArray(strData, strDelimiter) {
    strDelimiter = (strDelimiter || ",");
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
