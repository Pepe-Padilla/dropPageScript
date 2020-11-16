// Variables globales
var files = new Map(); // Datos de un fichero
var csvResultKO = []; // Resultado guardado para descargar el CSV final de casos KO
var csvResultOK = []; // Resultado guardado para descargar el CSV final de casos OK
var dropState = true; // Estado en que se puede agregar ficheros

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
    let exception = 0;
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
    var arrCIQCase = files.get("fileCIQ");
    var arrCIO = files.get("fileCIO");
    var arrCIOCase = files.get("fileCIO");
    var arrNEQ = files.get("fileNEQ");
    var arrDocuments = files.get("fileDocuments");
    var arrHistorico = files.get("fileHistorico");
    var arrExceptions = files.get("fileExceptions");
    
    // Sorts
    console.log("Sorts INI");
    sorter(arrCIQ,getKeyCol("ciq"));
    sorter(arrCIQCase,getKeyCol("ciqcase"));
    sorter(arrCIO,getKeyCol("cio"));
    sorter(arrCIOCase,getKeyCol("ciocase"));
    sorter(arrNEQ,getKeyCol("neq"));
    sorter(arrDocuments,getKeyCol("documents"));
    sorter(arrHistorico,getKeyCol("ciqcase"));
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

        // si es el primer renglon de títulos
        if(idCiq == "Id") {
            var ciqKO = ciq;
            ciqOK.push("Observaciones automáticas");
            ciqOK.push("Observaciones historicas ciq");
            ciqOK.push("Observaciones historicas case");
            csvResultKO.push(ciqKO.join(","));
            
            var ciqOK = ciq;
            // Campos extra para el informe
            ciqOK.push("Observaciones automáticas");
            ciqOK.push("Observaciones historicas ciq");
            ciqOK.push("Observaciones historicas case");
            csvResultOK.push(ciqOK.join(","));
            
            continue;
        }

        if(status == "Formalized"){ 
            // Con CIO
            if(buscaId(idCiq,arrCIO,getKeyCol("cio"))){
                conPedido++;
                if(conPedido % 20000 == 0) console.log(conPedido + " pedidos encontrados hasta el momento");
            // excepciones:
            } else if(buscaId(idCase,arrExceptions,getKeyCol("exceptions"))) { 
                exception++;
            // Sin CIO
            } else {
                // obtener la fecha más atigua
                if(createdDate < masAntigua) masAntigua = createdDate;

                // Busca todo lo relacionado al Case
                let ciqs = buscaArr(idCase,arrCIQCase,getKeyCol("ciqcase"));
                let cios = buscaArr(idCase,arrCIOCase,getKeyCol("ciocase"));
                let neqs = buscaArr(idCase,arrNEQ,getKeyCol("neq"));
                let documents = buscaArr(idCase,arrDocuments,getKeyCol("documents"));
                let historicos = buscaArr(idCase,arrHistorico,getKeyCol("ciqcase"));

                // 1 bonos "Bonos Sociales no generan CIO"
                // 2 Quotes Pending o CIQ Pending "Necesidad pendiente de Batch"
                // 3 Calidad/Docs In-Transit In Review "Caso de Calidad o Documentación pendiente de finalizar"
                // 4 Calidad/Docs In-Transit Pending_after_BO	"Pendiente formalizar neuvamente tras rechazo de caso de Calidad o Documentación"
                // 5 Calidad/Docs In-Transit Signature_pending "Pendiente formalizar neuvamente tras rechazo de caso de Calidad o Documentación"
                // 6 Calidad/Docs In-Transit Signed "Pendiente formalizar neuvamente tras rechazo de caso de Calidad o Documentación"
                // 7 Formalized sobre quote no CRM_Transfer_Pending "Quote inconsitente sobre CIQ Formalizado"
                // 8 quote en un estado distino de Closed o CRM_Transfer_Pending "Necesidad con Quote en estado inconsitente"
                // 9 ya hay CIOs hermanos "Ya hay cios en esta necesidad"**
                //-- warnings de relanzamiento:
                // 50 muchas CIQS "Muchos ciqs en la misma necesidad"
                // 51 FI_CI_FLG_Validaciones_OK__c = false "Validaciones de CC y CD saltadas"
                // 52 CRM_Transfer_Pending Cancelled "Quote CRM_Transfer_Pending sobre CIQ Cancelled"
                // 53 Casos de calidad/docu en vuelo sobre formalizados "Tienen casos de calidad o documentación pendientes"
                // 100 OK relanzar "Relanzar"

                let errorCode = 100;

                // Validaciones sonbre ciqs
                for(var iciq = 0;iciq<ciqs.length;iciq++) {
                    let ciqh =ciqs[iciq];

                    // variables
                    let ciqId = ciqh[getKeyCol("ciq")];
                    let ciqStatus = ciqh[getKeyCol("ciqStatus")];
                    let ciqQuoteStatus = ciqh[getKeyCol("ciqQuoteStatus")];
                    let bono = ciqh[getKeyCol("ciqBono")];
                    let bonoIncondicional = ciqh[getKeyCol("ciqBonoinCondicional")];
                    let flagValidacionesOK = ciqh[getKeyCol("ciqValidacionesOK")].toLowerCase();
                    let flagCCNe = ciqh[getKeyCol("ciqCCNe")].toLowerCase();
                    let flagCCOK = ciqh[getKeyCol("ciqCCOK")].toLowerCase();
                    let flagCDNe = ciqh[getKeyCol("ciqCDNe")].toLowerCase();
                    let flagCDOK = ciqh[getKeyCol("ciqCDOK")].toLowerCase();
                    let ciqCalidad = ciqh[getKeyCol("ciqCalidad")];

                    if(bono.toLowerCase() == "true" && bonoIncondicional.toLowerCase() ==  "false") errorCode = 1;
                    else if(ciqStatus == "Pending" && errorCode > 2) errorCode = 2;
                    else if(ciqStatus == "In Review" && ciqQuoteStatus == "In-Transit" && errorCode > 3) errorCode = 3;
                    else if(ciqStatus == "Pending_after_BO" && ciqQuoteStatus == "In-Transit" && errorCode > 4) errorCode = 4;
                    else if(ciqStatus == "Signature_pending" && ciqQuoteStatus == "In-Transit" && errorCode > 5) errorCode = 5;
                    else if(ciqStatus == "Signed" && ciqQuoteStatus == "In-Transit" && errorCode > 6) errorCode = 6;
                    else if(ciqStatus == "Formalized" && ciqQuoteStatus != "CRM_Transfer_Pending" && errorCode > 7) errorCode = 7;
                    else if(ciqStatus == "Formalized" && 
                        (flagValidacionesOK != "true" || (flagCCNe == "true" && flagCCOK != "true") || (flagCDNe == "true" && flagCDOK != "true"))
                        && errorCode > 51) errorCode = 51;
                    else if(ciqStatus == "Cancelled" && ciqQuoteStatus == "CRM_Transfer_Pending" && errorCode > 52) errorCode = 52;
                    else if(ciqStatus == "Formalized" && errorCode > 52) {
                        // Calidad 
                        if(ciqCalidad != "" && ciqCalidad != "Closed" && ciqCalidad != "Resuelto Motivo: Responsable endesa" && 
                           ciqCalidad != "Resuelto Motivo: Cancelacion Front" && ciqCalidad != "Resolved") errorCode = 52;
                        // Docs
                        for(var idocu=0;idocu<documents.length; idocu++) {
                            let docu = documents[idocu];
                            let docuCiqId = docu[getKeyCol("documentacionCiqId")];
                            if(docuCiqId == ciqId) errorCode = 52; 
                        }
                    }
                }
                
                // validaciones del NEQ
                for(var ineq=0;ineq<neqs.length;ineq++) {
                    let neqLocal =  neqs[ineq];
                    let neqStatus = neqLocal[getKeyCol("neqStatus")];
                    if(neqStatus == "Pending" && errorCode > 2) errorCode = 2;
                    else if(neqStatus != "Closed" && neqStatus != "CRM_Transfer_Pending" && errorCode > 8) errorCode = 8;
                }

                // Otras validaciones
                if(ciqs.length > 6 && errorCode > 50) errorCode = 50;
                if(cios.length > 0 && errorCode > 9)  errorCode = 9;
                
                let histo = getHistoricos(historicos,idCiq);

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
                }
            }
        }
    }
    console.log("Look for cases: END");
    
    // Desplegamos el resultado
    console.log("KO["+sinPedidoCasos+"](Cases["+sinPedido+"]) OK["+sinCIO+"] fecha más antigua["+masAntigua+"]");
    resultado.appendChild(parrafo("CIQ registradas: "+ (conPedido + sinPedidoCasos + exception + sinCIO)));
    resultado.appendChild(parrafo("CIQ con CIO: "+ conPedido));
    resultado.appendChild(parrafo("Excepciones: "+ exception));
    resultado.appendChild(parrafo("CIQ sin CIO OK: "+ sinCIO));
    resultado.appendChild(parrafo("CIQ sin CIO KO: "+ sinPedidoCasos + " (con Case Repetido:"+sinPedido+")"));
    resultado.appendChild(tablaResultante(cioResult));

    // reactivamos botones de descarga de CSVs
    document.getElementById("getCsvKO").disabled = false;
    document.getElementById("getCsvOK").disabled = false;
}

function getHistoricos(historicos,idCiq) {
    let msgCiq = "";
    let msgCase = "";
    for(var i=0;i<historicos.length;i++) {
        var hist = historicos[i];
        if(i=0) msgCase = hist[getKeyCol("historicoCase")];
        if(hist[getKeyCol("ciq")]==idCiq) {
            msgCiq = hist[getKeyCol("historicoCiq")];
            msgCase = hist[getKeyCol("historicoCase")];
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

// regresa un parrafo DOM para agregar a algún otro elemento del DOM con el mensaje de entrada
function parrafo(mensaje) {
    let para = document.createElement("p");
    let res = document.createTextNode(mensaje);
    para.appendChild(res);
    return para;
}

// función para buscar el id en busqueda binaria, al encontrarlo busca en un arrglo todos los casos
function buscaArr(id,arr,column) {
    let mid = binarySearch(id,arr,column, 0, arr.length-1);
    
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
    return binarySearch(id,arrCSV,column, 0, arrCSV.length-1) >= 0;
}

// busqueda binaria recursiva FTW
function binarySearch(id,arrCSV,column, start, end){
    // condición base, no encontrado
    if(start > end) return -1;

    // busqueda de mid y comparación
    let mid = Math.floor((start + end) /2);
    let row = arrCSV[mid];
    var compare = id.toLowerCase().localeCompare(row[column].toLowerCase());

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
    fr.readAsText(file);
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
        case "ciqquote":
        case "documentacionciqid":
			return 2;
		case "exceptions":
            return 3;
        case "ciqcase":
        case "ciocase":
            return 4;
        case "neqstatus":
            return 6;
        case "ciqquotestatus":
            reutrn 8;
        case "ciqstatus":
            reutrn 9;
        case "documents":
            reutrn 11;
        case "ciqcratedate":
            reutrn 14;
        case "ciqbono":
            reutrn 31;
        case "ciqbonoincondicional":
            reutrn 32;
        case "ciqccne":
            reutrn 36;
        case "ciqccok":
            reutrn 37;
        case "ciqcdne":
            reutrn 38;
        case "ciqcdok":
            reutrn 39;
        case "ciqvalidacionesok":
            reutrn 42;
        case "ciqcalidad":
            reutrn 44;
        case "historicociq":
            reutrn 47;
        case "historicocase":
            reutrn 48;
		default:
            console.log("getKeyCol["+elementId+"]");
			return 0;
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
