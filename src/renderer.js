const fs = require("fs");
const yaml = require("js-yaml");
const os = require("os");
const path = require("path");

let filesData = {}; // To store the contents of all the files
let filePaths = {}; // To store the original paths of the uploaded files

document.getElementById("fileInput").addEventListener("change", (event) => {
  const files = event.target.files;
  for (let file of files) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const yamlContent = yaml.load(content);
      filesData[file.name] = yamlContent;
      filePaths[file.name] = file.path; // Store the file path
      console.log(`Loaded content for ${file.name}:`, yamlContent); // Logging for debugging
      displayData();
      updateEnvironmentSelect();
    };
    reader.readAsText(file);
  }
});

document.getElementById("generateButton").addEventListener("click", () => {
  const environmentSelect = document.getElementById("environmentSelect");
  const selectedEnvironment = environmentSelect.value;
  if (selectedEnvironment) {
    generateYamlForEnvironment(selectedEnvironment);
  } else {
    alert("Please select an environment.");
  }
});

function updateEnvironmentSelect() {
  const environmentSelect = document.getElementById("environmentSelect");
  const environments = Object.keys(filesData)
    .filter(
      (fileName) =>
        fileName.startsWith("override.") && fileName.endsWith(".yaml")
    )
    .map((fileName) => fileName.replace("override.", "").replace(".yaml", ""));

  environmentSelect.innerHTML =
    '<option value="" disabled selected>Select Environment</option>';
  environments.forEach((env) => {
    const option = document.createElement("option");
    option.value = env;
    option.textContent = env;
    environmentSelect.appendChild(option);
  });
}

function generateYamlForEnvironment(environment) {
  const baseFileName = "values.yaml";
  const overrideFileName = `override.${environment}.yaml`;
  const finalFileName = `final.${environment}.yaml`;
  const downloadFolderPath = path.join(os.homedir(), "Downloads");
  const finalFilePath = path.join(downloadFolderPath, finalFileName);

  if (!(baseFileName in filesData) || !(overrideFileName in filesData)) {
    alert(
      "Base file or override file not found. Please upload the necessary files."
    );
    return;
  }

  const baseContent = filesData[baseFileName];
  const overrideContent = filesData[overrideFileName];

  const finalContent = mergeDeep(baseContent, overrideContent);

  const yamlContent = yaml.dump(finalContent, {
    lineWidth: -1, // No line wrap
    noCompatMode: true, // Avoid compatibility mode
    styles: {
      "!!null": "canonical", // Use canonical style for null values
    },
  });

  fs.writeFile(finalFilePath, yamlContent, (err) => {
    if (err) {
      alert("An error occurred while saving the file: " + finalFilePath);
      console.error(err);
    } else {
      alert("File generated successfully: " + finalFilePath);
    }
  });
}

function mergeDeep(target, source) {
  const isObject = (obj) => obj && typeof obj === "object";

  if (!isObject(target) || !isObject(source)) {
    return source;
  }

  Object.keys(source).forEach((key) => {
    const targetValue = target[key];
    const sourceValue = source[key];

    if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
      // Handle replacing arrays with same 'id' values
      const mergedArray = sourceValue.map((sourceItem) => {
        const targetIndex = targetValue.findIndex(
          (targetItem) => targetItem.id === sourceItem.id
        );
        if (targetIndex !== -1) {
          targetValue[targetIndex] = mergeDeep(
            targetValue[targetIndex],
            sourceItem
          );
        } else {
          targetValue.push(sourceItem);
        }
        return sourceItem;
      });
      target[key] = mergedArray;
    } else if (isObject(targetValue) && isObject(sourceValue)) {
      target[key] = mergeDeep(Object.assign({}, targetValue), sourceValue);
    } else {
      target[key] = sourceValue;
    }
  });

  return target;
}

function displayData() {
  const tableContainer = document.getElementById("tableContainer");
  tableContainer.innerHTML = "";

  if (Object.keys(filesData).length === 0) {
    return;
  }

  // Create a table
  const table = document.createElement("table");
  const headerRow = document.createElement("tr");

  // Create the first cell for the entry names
  const firstCell = document.createElement("th");
  firstCell.textContent = "Entry";
  headerRow.appendChild(firstCell);

  // Ensure values.yaml is the first column if it exists
  const fileNames = Object.keys(filesData);
  if (fileNames.includes("values.yaml")) {
    fileNames.sort((a, b) => {
      if (a === "values.yaml") return -1;
      if (b === "values.yaml") return 1;
      return 0;
    });
  }

  // Add a column for each file
  for (let fileName of fileNames) {
    const th = document.createElement("th");
    th.textContent = fileName;
    th.addEventListener("click", () => openFile(filePaths[fileName])); // Click to open the file
    headerRow.appendChild(th);
  }
  table.appendChild(headerRow);

  // Gather all unique entry names
  const allEntries = new Set();
  for (let fileName in filesData) {
    Object.keys(filesData[fileName]).forEach((key) => allEntries.add(key));
  }

  // Create a row for each entry
  allEntries.forEach((entry) => {
    const row = document.createElement("tr");
    const entryCell = document.createElement("td");
    entryCell.textContent = entry;
    row.appendChild(entryCell);

    // Create a cell for each file's value for this entry
    for (let fileName of fileNames) {
      const cell = document.createElement("td");
      const textArea = document.createElement("textarea");
      const cellContent = filesData[fileName][entry] || "N/A"; // Use 'N/A' for missing entries
      console.log(`Setting content for ${fileName} - ${entry}:`, cellContent); // Logging for debugging

      // Configure YAML dump options
      const yamlContent = yaml.dump(cellContent, {
        lineWidth: -1, // No line wrap
        noCompatMode: true, // Avoid compatibility mode
        styles: {
          "!!null": "canonical", // Use canonical style for null values
        },
      });
      textArea.value = yamlContent;
      textArea.style.overflow = "hidden";
      textArea.style.resize = "none";
      textArea.style.border = "none"; // Hide the border
      textArea.style.whiteSpace = "pre-wrap"; // Ensure content wraps

      // Append textArea to cell first
      cell.appendChild(textArea);
      row.appendChild(cell);

      // Adjust the height and width after appending to the DOM
      adjustTextAreaSize(textArea);

      textArea.addEventListener("input", (e) => {
        adjustTextAreaSize(textArea);
        const updatedValue = yaml.load(e.target.value);
        filesData[fileName][entry] =
          updatedValue === "N/A" ? null : updatedValue; // Handle 'N/A' as null
        console.log(`Updated ${fileName} - ${entry}:`, updatedValue); // Logging for debugging
      });
    }

    table.appendChild(row);
  });

  tableContainer.appendChild(table);

  // Ensure all text areas are adjusted after the DOM update
  requestAnimationFrame(() => {
    const textAreas = document.querySelectorAll("textarea");
    textAreas.forEach(adjustTextAreaSize);
  });
}

function adjustTextAreaSize(textArea) {
  textArea.style.height = "auto";
  textArea.style.width = "auto";

  const lines = textArea.value.split("\n");
  const maxWidth = Math.max(
    ...lines.map((line) => getTextWidth(line, textArea))
  );

  textArea.style.height = textArea.scrollHeight + "px";
  textArea.style.width = maxWidth + "px";
}

function getTextWidth(text, textArea) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = getComputedStyle(textArea).font;
  return context.measureText(text).width;
}

document.getElementById("saveButton").addEventListener("click", () => {
  for (let fileName in filesData) {
    const filePath = filePaths[fileName]; // Get the original file path
    const yamlContent = yaml.dump(filesData[fileName], {
      lineWidth: -1, // No line wrap
      noCompatMode: true, // Avoid compatibility mode
      styles: {
        "!!null": "canonical", // Use canonical style for null values
      },
    });
    console.log(`Saving content for ${fileName} to ${filePath}:`, yamlContent); // Logging for debugging
    fs.writeFile(filePath, yamlContent, (err) => {
      if (err) {
        alert("An error occurred while saving the file: " + filePath);
        console.error(err);
      } else {
        alert("File saved successfully: " + filePath);
        console.log(`File ${filePath} saved successfully.`); // Logging for debugging
      }
    });
  }
});

document.getElementById("exportButton").addEventListener("click", () => {
  let htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>YAML Comparison</title>
        <style>
            table {
                width: 100%;
                border-collapse: collapse;
            }
            th, td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
            }
            th {
                background-color: #f2f2f2;
            }
            pre {
                margin: 0;
                font-family: inherit;
                font-size: inherit;
                white-space: pre-wrap; /* Wrap long lines */
                word-wrap: break-word; /* Break long words */
            }
        </style>
    </head>
    <body>
        <table>
            <tr>
                <th>Entry</th>`;

  // Add table headers
  for (let fileName in filesData) {
    htmlContent += `<th>${fileName}</th>`;
  }

  htmlContent += `</tr>`;

  // Gather all unique entry names
  const allEntries = new Set();
  for (let fileName in filesData) {
    Object.keys(filesData[fileName]).forEach((key) => allEntries.add(key));
  }

  // Create a row for each entry
  allEntries.forEach((entry) => {
    htmlContent += `<tr><td>${entry}</td>`;
    for (let fileName in filesData) {
      const cellContent = filesData[fileName][entry] || "N/A"; // Use 'N/A' for missing entries
      const yamlContent = yaml.dump(cellContent, {
        lineWidth: -1,
        noCompatMode: true,
        styles: {
          "!!null": "canonical",
        },
      });
      htmlContent += `<td><pre>${yamlContent}</pre></td>`;
    }
    htmlContent += `</tr>`;
  });

  htmlContent += `
        </table>
    </body>
    </html>`;

  fs.writeFile("comparison.html", htmlContent, (err) => {
    if (err) {
      alert("An error occurred while exporting to HTML.");
      console.error(err);
    } else {
      alert("Comparison exported to comparison.html");
    }
  });
});

function openFile(filePath) {
  if (window.require) {
    const { shell } = window.require("electron");
    shell.openPath(filePath);
  } else {
    alert("Cannot open file. Electron shell module is not available.");
  }
}
