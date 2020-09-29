// Variables globales
var files = new Map(); // Datos de un fichero
var csvResultKO = []; // Resultado guardado para descargar el CSV final
var csvResultOK = [];
var csvREsultH = [];

//Drop invididual
function dropHandler(ev,element) {
    console.log('File(s) dropped');

    // Prevent default behavior (Prevent file from being opened)
    ev.preventDefault();

    if (ev.dataTransfer.items) {
        // Use DataTransferItemList interface to access the file(s)
        if (ev.dataTransfer.items[0].kind === 'file') {
            var file = ev.dataTransfer.items[0].getAsFile();
            if(file.name.substr(file.name.length - 4) != ".csv" ) {
                alert("La extensión debe ser .csv");
                return false;
            }
            fileCSVToArray(file,element.id+"");
            console.log('saving file.name['+file.name+'] on['+element.id+']');
            document.getElementById(element.id+"Text").innerHTML=file.name;
        }

    // Use DataTransfer interface to access the file(s)
    } else if (ev.dataTransfer.files.length > 0) {
        var file = ev.dataTransfer.files[0];
        if(file.name.substr(file.name.length - 4) != ".csv" ) {
            alert("La extensión debe ser .csv");
            return false;
        }
        fileCSVToArray(file,element.id+"");
        console.log('saving file.name['+file.name+'] on['+element.id+']');
        document.getElementById(element.id+"Text").innerHTML=file.name;
    } 

    // Pass event to removeDragData for cleanup
    removeDragData(ev);
}

// Drop de varios ficheros
function dropHandlerAll(ev) {
    console.log('File(s) dropped');

    // Prevent default behavior (Prevent file from being opened)
    ev.preventDefault();

    if (ev.dataTransfer.items) {
        // Use DataTransferItemList interface to access the file(s)
        for (var i = 0; i < ev.dataTransfer.items.length; i++) {
            if (ev.dataTransfer.items[i].kind === 'file') {
                var file = ev.dataTransfer.items[i].getAsFile();
                let elementId = "";
                if (file.name == "ciq.csv") elementId = "fileCIQ";
                else if (file.name == "cio.csv") elementId = "fileCIO";
                else if (file.name == "cioh.csv") elementId = "fileCIOH";
                else if (file.name == "neq.csv") elementId = "fileNEQ";
                else if (file.name == "calidad.csv") elementId = "fileCalidad";
                else if (file.name == "documents.csv") elementId = "fileDocuments";
                else if (file.name == "exceptions.csv") elementId = "fileExceptions";
                if (elementId == "") continue;
                fileCSVToArray(file,elementId);
                console.log('saving file.name[' + file.name + '] on[' + elementId + ']');
                document.getElementById(elementId + "Text").innerHTML = file.name;
            }
        }

    // Use DataTransfer interface to access the file(s)
    } else {
        for (var i = 0; i < ev.dataTransfer.files.length; i++) {
            var file = ev.dataTransfer.files[i];
            let elementId = "";
            if (file.name == "ciq.csv") elementId = "fileCIQ";
                else if (file.name == "cio.csv") elementId = "fileCIO";
                else if (file.name == "cioh.csv") elementId = "fileCIOH";
                else if (file.name == "neq.csv") elementId = "fileNEQ";
                else if (file.name == "calidad.csv") elementId = "fileCalidad";
                else if (file.name == "documents.csv") elementId = "fileDocuments";
                else if (file.name == "exceptions.csv") elementId = "fileExceptions";
            if (elementId == "") continue;
            fileCSVToArray(file,elementId);
            console.log('saving file.name[' + file.name + '] on[' + elementId + ']');
            document.getElementById(elementId + "Text").innerHTML = file.name;
        }
    } 

    // Pass event to removeDragData for cleanup
    removeDragData(ev);
}

// Valida y calcula el resultado
function calculate() {
    document.getElementById("calculateBotton").disabled = true;
    document.getElementById("getCsvKO").disabled = true;
    document.getElementById("getCsvH").disabled = true;
    document.getElementById("getCsvOK").disabled = true;
    console.log("calculating...");
    var resultado = document.getElementById("resultado");
    resultado.innerHTML = "";
    let cioResult = new Map();
    let exception = 0;
    let ciohs = 0;
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
    if(!files.has("fileCIQ") || 
    !files.has("fileCIO") || 
    !files.has("fileCIOH") || 
    !files.has("fileNEQ") || 
    !files.has("fileCalidad") || 
    !files.has("fileDocuments") || 
    !files.has("fileExceptions") ) {
        document.getElementById("calculateBotton").disabled = false;
        let res = document.createTextNode("Faltan archivos o aun se estan procesando");
        resultado.appendChild(res);
        return false;
    }
    console.log("Valitations OK");

    // Va lo bueno
    var arrCIQ = files.get("fileCIQ");
    var arrCIO = files.get("fileCIO");
    var arrCIOH = files.get("fileCIOH");
    var arrNEQ = files.get("fileNEQ");
    var arrCalidad = files.get("fileCalidad");
    var arrDocuments = files.get("fileDocuments");
    var arrExceptions = files.get("fileExceptions");
    
    console.log("Look for cases: INI");
    for(let ciq of arrCIQ) {

        let idCiq = ciq[1];
        let idCase = ciq[5];
        let idQuote = ciq[3];
        let status = ciq[6];
        let createdDate = ciq[7];

        // si es el primer renglon de títulos
        if(idCiq == "Id") {
            csvResultKO.push(ciq.join(","));
            
            var ciqOK = ciq;
            ciqOK.push("Has_Quotes");
            ciqOK.push("Has_Calidad");
            ciqOK.push("Has_Documents");
            csvResultOK.push(ciqOK.join(","));
            
            continue;
        }

        // Con CIO
        if(buscaId(idCiq,arrCIO,2)){
            conPedido++;
            if(conPedido % 20000 == 0) console.log(conPedido + " pedidos encontrados hasta el momento");
        // excepciones:
        } else if(buscaId(idCiq,arrExceptions,0)) { 
            exception++;
        // CIOH
        } else if(buscaId(idCase,arrCIOH,5)) {
            ciohs++;
            csvREsultH.push(ciq.join(","));
        // Sin CIO
        } else {
            var hasNEQ = buscaId(idCase,arrNEQ,2);
            var hasCalidad = buscaId(idCase,arrCalidad,8);
            var hasDocuments = buscaId(idCiq,arrDocuments,2);
            
            if(createdDate < masAntigua) masAntigua = createdDate;

            // Sin CIO OK
            if(hasNEQ || hasCalidad || hasDocuments) {
                sinCIO++;
                var ciqOK = ciq;
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
    console.log("KO["+sinPedidoCasos+"](Cases["+sinPedido+"]) CIOH["+ciohs+"] OK["+sinCIO+"] fecha más antigua["+masAntigua+"]");
    resultado.appendChild(parrafo("CIQ registradas: "+ (conPedido + sinPedidoCasos + exception + sinCIO + ciohs)));
    resultado.appendChild(parrafo("CIQ con CIO: "+ conPedido));
    resultado.appendChild(parrafo("Excepciones: "+ exception));
    resultado.appendChild(parrafo("CIQ sin CIO H: "+ ciohs));
    resultado.appendChild(parrafo("CIQ sin CIO OK: "+ sinCIO));
    resultado.appendChild(parrafo("CIQ sin CIO KO: "+ sinPedidoCasos + " (con Case Repetido:"+sinPedido+")"));
    resultado.appendChild(tablaSigned(ciqSigned));
    resultado.appendChild(tablaResultante(cioResult));

    // activamos la descarga de CSVs
    document.getElementById("getCsvKO").disabled = false;
    document.getElementById("getCsvH").disabled = false;
    document.getElementById("getCsvOK").disabled = false;
}

// Arama la tabla con el resultado
function tablaResultante(cioResult){
    let table = document.createElement("table");

    // THead
    let thead = table.createTHead();
    let hrow = thead.insertRow();
    hrow.insertCell().appendChild(document.createTextNode("CaseNumber"));
    hrow.insertCell().appendChild(document.createTextNode(" "));
    hrow.insertCell().appendChild(document.createTextNode("Id"));
    hrow.insertCell().appendChild(document.createTextNode("NE__Status__c"));
    hrow.insertCell().appendChild(document.createTextNode(" "));
    hrow.insertCell().appendChild(document.createTextNode("Id"));
    hrow.insertCell().appendChild(document.createTextNode("NE__Status__c"));
    
    // resto de datos
    let tBody = table.createTBody();
    for (let [caseNumber, idQuote] of cioResult.entries()) {
        let row = tBody.insertRow();
        row.insertCell().appendChild(document.createTextNode("'"+caseNumber+"',"));
        row.insertCell().appendChild(document.createTextNode(""));
        row.insertCell().appendChild(document.createTextNode(idQuote));
        row.insertCell().appendChild(document.createTextNode("In-Transit"));
        row.insertCell().appendChild(document.createTextNode(""));
        row.insertCell().appendChild(document.createTextNode(idQuote));
        row.insertCell().appendChild(document.createTextNode("CRM_Transfer_Pending"));
    }
    
    return table;
}

// Arama la tabla con el resultado
function tablaSigned(ciqSigned){
    let table = document.createElement("table");

    // THead
    let thead = table.createTHead();
    let hrow = thead.insertRow();
    hrow.insertCell().appendChild(document.createTextNode("Id"));
    hrow.insertCell().appendChild(document.createTextNode("NE__Status__c"));
    
    // resto de datos
    let tBody = table.createTBody();
    for (let ciqStat of ciqSigned.values()) {
        let row = tBody.insertRow();
        row.insertCell().appendChild(document.createTextNode(ciqStat));
        row.insertCell().appendChild(document.createTextNode("Formalized"));
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
    return binarySearch(id,arrCSV,column, mid-1, end);
}

// Aquí convertimos el fichero en texto e inicializamos las variables para trabajar los datos
function fileCSVToArray(file,elementId) {
    console.log("Reading: "+elementId);
    var fr = new FileReader();
    fr.onload = function() { 
        var fileText = fr.result;
        console.log("Procesing: "+elementId);
        var arrprocesado = CSVToArray(fileText);
        if(elementId == "fileCIQ") {
            arrprocesado.sort(function(a,b) {
                // encabezados siempre arriba
                if(a[1] == "Id") return -1;
                if(b[1] == "Id") return 1;
                // sort de javascript que el de salesforce aveces va mal
                return a[1].toLowerCase().localeCompare(b[1].toLowerCase());
            });
        } else if(elementId == "fileCIO") {
            arrprocesado.sort(function(a,b) {
                // encabezados siempre arriba
                if(a[1] == "Id") return -1;
                if(b[1] == "Id") return 1;
                // sort de javascript que el de salesforce aveces va mal
                return a[2].toLowerCase().localeCompare(b[2].toLowerCase());
            });
        } else if(elementId == "fileCIOH") {
            arrprocesado.sort(function(a,b) {
                // encabezados siempre arriba
                if(a[1] == "Id") return -1;
                if(b[1] == "Id") return 1;
                // sort de javascript que el de salesforce aveces va mal
                return a[5].toLowerCase().localeCompare(b[5].toLowerCase());
            });
        } else if(elementId == "fileNEQ") {
            arrprocesado.sort(function(a,b) {
                // encabezados siempre arriba
                if(a[1] == "Id") return -1;
                if(b[1] == "Id") return 1;
                // sort de javascript que el de salesforce aveces va mal
                return a[2].toLowerCase().localeCompare(b[2].toLowerCase());
            });
        } else if(elementId == "fileCalidad") {
            arrprocesado.sort(function(a,b) {
                // encabezados siempre arriba
                if(a[1] == "Id") return -1;
                if(b[1] == "Id") return 1;
                // sort de javascript que el de salesforce aveces va mal
                return a[8].toLowerCase().localeCompare(b[8].toLowerCase());
            });
        } else if(elementId == "fileDocuments") {
            arrprocesado.sort(function(a,b) {
                // encabezados siempre arriba
                if(a[1] == "Id") return -1;
                if(b[1] == "Id") return 1;
                // sort de javascript que el de salesforce aveces va mal
                return a[2].toLowerCase().localeCompare(b[2].toLowerCase());
            });
        } else if(elementId == "fileExceptions") {
            arrprocesado.sort(function(a,b) {
                // encabezados siempre arriba
                if(a[0] == "Id") return -1;
                if(b[0] == "Id") return 1;
                // sort de javascript que el de salesforce aveces va mal
                return a[0].toLowerCase().localeCompare(b[0].toLowerCase());
            });
        }
        files.set(elementId,arrprocesado);
        console.log("Done: "+elementId);
    }
    fr.readAsText(file);
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

// Crea el CSV ya filtrado
function saveCSVH() {
    console.log("save csv CIO Hijos");
    
    var text = csvREsultH.join("\n");
    const filename = "CIQsinCIOconHermanos.csv";

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
