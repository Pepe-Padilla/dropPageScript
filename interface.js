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
    fileCSVToArray(file,elementId+"");
    console.log('saving file.name['+file.name+'] on['+elementId+']');
    document.getElementById(elementId+"Text").innerHTML= "LOADING FILE...  <img src='img/pocessing.png' width='20' height='20' >";
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
	
    if(!dropState) { alert("Can't drop afer generate process");	removeDragData(ev); return false; }

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
    else if (fileName == "ciqh.csv") elementId = "fileCIQH";
    else if (fileName == "cioh.csv") elementId = "fileCIOH";
    else if (fileName == "neq.csv") elementId = "fileNEQ";
    else if (fileName == "calidad.csv") elementId = "fileCalidad";
    else if (fileName == "documents.csv") elementId = "fileDocuments";
    else if (fileName == "exceptions.csv") elementId = "fileExceptions";
	
	return elementId;
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
    ciqSigned = [];

    // validaciones
    if(!files.has("fileCIQ") || !files.has("fileCIO") || !files.has("fileCIQH") || 
    !files.has("fileCIOH") || !files.has("fileNEQ") || !files.has("fileCalidad") || 
    !files.has("fileDocuments") || !files.has("fileExceptions") ) {
        document.getElementById("calculateBotton").disabled = false;
		dropState = true;
        let res = document.createTextNode("Faltan archivos por subir o aun se estan procesando");
        resultado.appendChild(res);
        return false;
    }
    console.log("Valitations OK");
	
	// obtenermos la info de los ficheros en variables locales
    var arrCIQ = files.get("fileCIQ");
    var arrCIO = files.get("fileCIO");
    var arrCIQH = files.get("fileCIQH");
    var arrCIOH = files.get("fileCIOH");
    var arrNEQ = files.get("fileNEQ");
    var arrCalidad = files.get("fileCalidad");
    var arrDocuments = files.get("fileDocuments");
    var arrExceptions = files.get("fileExceptions");
    
    // Va lo bueno
    console.log("Look for cases: INI");
    for(let ciq of arrCIQ) {

        let idCiq = ciq[1];
        let idCase = ciq[5];
        let idQuote = ciq[3];
        let status = ciq[6];
        let createdDate = ciq[11];

        // si es el primer renglon de títulos
        if(idCiq == "Id") {
            csvResultKO.push(ciq.join(","));
            
            var ciqOK = ciq;
            ciqOK.push("Has_CIQ_Childs");
            ciqOK.push("Has_CIO_Childs");
            ciqOK.push("Has_NEQ");
            ciqOK.push("Has_Calidad");
            ciqOK.push("Has_Documents");
            csvResultOK.push(ciqOK.join(","));
            
            continue;
        }

        // Con CIO
        if(buscaId(idCiq,arrCIO,getKeyCol("cio"))){
            conPedido++;
			if(conPedido % 20000 == 0) console.log(conPedido + " pedidos encontrados hasta el momento");
        // excepciones:
        } else if(buscaId(idCiq,arrExceptions,getKeyCol("exceptions"))) { 
            exception++;
        // Sin CIO
        } else {
            var hasCIQH = buscaId(idCase,arrCIQH,getKeyCol("ciqh"))
            var hasCIOH = buscaId(idCase,arrCIOH,getKeyCol("cioh"));
            var hasNEQ = buscaId(idCase,arrNEQ,getKeyCol("neq"));
            var hasCalidad = buscaId(idCase,arrCalidad,getKeyCol("calidad"));
            var hasDocuments = buscaId(idCiq,arrDocuments,getKeyCol("documents"));
            
            if(createdDate < masAntigua) masAntigua = createdDate;

            // Sin CIO OK
            if(hasCIQH || hasCIOH || hasNEQ || hasCalidad || hasDocuments) {
                sinCIO++;
                var ciqOK = ciq;
                ciqOK.push(hasCIQH);
                ciqOK.push(hasCIOH);
                ciqOK.push(hasNEQ);
                ciqOK.push(hasCalidad);
                ciqOK.push(hasDocuments);
                csvResultOK.push(ciqOK.join(","));
            // Sin CIO KO
            } else {
                if(status.localeCompare("Signed") == 0) ciqSigned.push(idCiq);
                sinPedidoCasos++;
                csvResultKO.push(ciq.join(","));
                if (!cioResult.has(idCase)) {
                    sinPedido++;
                    cioResult.set(idCase, idQuote);
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
        row.insertCell().appendChild(document.createTextNode("In-Transit"));
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

// función para buscar el id y limpia el array si esta en orden  (eficientiza )
function buscaId(id,arrCSV,column) {
    return binarySearch(id,arrCSV,column, 0, arrCSV.length-1);
}

// busqueda binaria recursiva FTW
function binarySearch(id,arrCSV,column, start, end){
    // condición base, no encontrado
    if(start > end) return false;

    // busqueda de mid y comparación
    let mid = Math.floor((start + end) /2);
    let row = arrCSV[mid];
    var compare = id.toLowerCase().localeCompare(row[column].toLowerCase());

    // encontrado!
    if(compare == 0) return true;

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
        var fileText = fr.result;
        console.log("Procesing: "+elementId);
        var arrprocesado = CSVToArray(fileText);
		let idCol = 1;
		let keyCol = getKeyCol(elementId);
		
		arrprocesado.sort(function(a,b) {
            // encabezados siempre arriba
            if(a[idCol] == "Id") return -1;
            if(b[idCol] == "Id") return 1;
            // sort de javascript que el de salesforce va como el culo
            return a[keyCol].toLowerCase().localeCompare(b[keyCol].toLowerCase());
        });
		
        files.set(elementId,arrprocesado);
        console.log("Done: "+elementId);
		document.getElementById(elementId + "Text").innerHTML = file.name+" <img src='img/check.png' width='20' height='20' >";
    }
    fr.readAsText(file);
}

// Acada resultado del fichero hay una columna clave de comparación aqui se define ese campo
function getKeyCol(elementId) {
	var eId = elementId.toLowerCase();
	if(eId.startsWith("file")) eId = eId.substring(4);
	switch(eId) {
		case "ciq":
			return 1;
		case "cio":
		case "neq":
		case "documents":
			return 2;
		case "ciqh":
		case "cioh":
			return 5;
		case "calidad":
			return 8;
		case "exceptions":
		default:
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
