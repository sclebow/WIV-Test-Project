import {Color, LineBasicMaterial, MeshBasicMaterial} from 'three';
import {IfcViewerAPI} from 'web-ifc-viewer';
import {IFCLoader} from 'web-ifc-three';
import {IfcAPI} from 'web-ifc/web-ifc-api';

const container = document.getElementById('viewer-container');
const viewer = new IfcViewerAPI({ container, backgroundColor: new Color(0xffffff)});
viewer.grid.setGrid();
viewer.axes.setAxes();

async function loadIfc(url) {
    // await viewer.IFC.setWasmPath("../");
    document.getElementById("file-input").remove();
    document.getElementById("file-input-container").remove();
    const model = await viewer.IFC.loadIfcUrl(url);
    model.removeFromParent();
    await viewer.shadowDropper.renderShadow(model.modelID);
    viewer.context.renderer.postProduction.active = true;

    // Serialize properties
    const result = await viewer.IFC.properties.serializeAllProperties(model);
    
    // Download the properties as JSON file
    const file = new File(result, 'properties');

    const link = document.createElement('a');
    document.body.appendChild(link);
    link.href = URL.createObjectURL(file);
    link.download = 'properties.json';
    link.click();
    link.remove();

    viewer.dimensions.active = true;
    viewer.dimensions.previewActive = true;

    const ifcProject = await viewer.IFC.getSpatialStructure(model.modelID);
    createTreeMenu(ifcProject);
    await setupAllCategories(ifcProject);

    // Setup Camera Controls
    const controls = viewer.context.ifcCamera.cameraControls;
    controls.setPosition(7.6, 4.3, 24.8, false);
    controls.setTarget(-7.1, -0.3, 2.5, false);
}

const input = document.getElementById("file-input");
input.addEventListener(
    "change",
    async (changed) => {
        const ifcURL = URL.createObjectURL(changed.target.files[0]);
        loadIfc(ifcURL);
    },
    false
);

window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();

window.ondblclick = async () => {
    const result = await viewer.IFC.selector.pickIfcItem();
    if (!result) {
        viewer.IFC.selector.unpickIfcItems();
        removeAllChildren(propsGUI);
        return;
    }
    console.log(result);
    const {modelID, id} = result;
    const props = await viewer.IFC.getProperties(modelID, id, true, false);
    createPropertiesMenu(props);
}

window.onkeydown = (event) => {
    console.log(event.code);
    if (event.code === 'KeyD') {
        viewer.dimensions.create();
    } else if (event.code === 'Delete') {
        console.log('Deleting');
        viewer.dimensions.delete();
    }
}

// Properties menu

const propsGUI = document.getElementById("ifc-property-menu-root");

function createPropertiesMenu(properties) {
    removeAllChildren(propsGUI);

    delete properties.psets;
    delete properties.mats;
    delete properties.type;

    for (let key in properties) {
        createPropertyEntry(key, properties[key]);
    }
}

function createPropertyEntry(key, value) {
    const propContainer = document.createElement("div");
    propContainer.classList.add("ifc-property-item");

    if (value === null || value === undefined) value = "undefined";
    else if (value.value) value = value.value;

    const keyElement = document.createElement("div");
    keyElement.textContent = key;
    propContainer.appendChild(keyElement);

    const valueElement = document.createElement("div");
    valueElement.classList.add("ifc-property-value");
    valueElement.textContent = value;
    propContainer.appendChild(valueElement);

    propsGUI.appendChild(propContainer);
}

function removeAllChildren(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

// Tree view
const toggler = document.getElementsByClassName("caret");
for (let i = 0; i < toggler.length; i++) {
    toggler[i].onclick = () => {
        toggler[i].parentElement.querySelector(".nested").classList.toggle("active");
        toggler[i].classList.toggle("caret-down");
    }
}

// Spatial tree menu

function createTreeMenu(ifcProject) {
    const root = document.getElementById("tree-root");
    removeAllChildren(root);
    const ifcProjectNode = createNestedChild(root, ifcProject);
    ifcProject.children.forEach(child => {
        constructTreeMenuNode(ifcProjectNode, child);
    })
}

function nodeToString(node) {
    return `${node.type} - ${node.expressID}`
}

function constructTreeMenuNode(parent, node) {
    const children = node.children;
    if (children.length === 0) {
        createSimpleChild(parent, node);
        return;
    }
    const nodeElement = createNestedChild(parent, node);
    children.forEach(child => {
        constructTreeMenuNode(nodeElement, child);
    })
}

function createNestedChild(parent, node) {
    const content = nodeToString(node);
    const root = document.createElement('li');
    createTitle(root, content);
    const childrenContainer = document.createElement('ul');
    childrenContainer.classList.add("nested");
    root.appendChild(childrenContainer);
    parent.appendChild(root);
    return childrenContainer;
}

function createTitle(parent, content) {
    const title = document.createElement("span");
    title.classList.add("caret");
    title.onclick = () => {
        title.parentElement.querySelector(".nested").classList.toggle("active");
        title.classList.toggle("caret-down");
    }
    title.textContent = content;
    parent.appendChild(title);
}

function createSimpleChild(parent, node) {
    const content = nodeToString(node);
    const childNode = document.createElement('li');
    childNode.classList.add('leaf-node');
    childNode.textContent = content;
    parent.appendChild(childNode);

    childNode.onmouseenter = () => {
        viewer.IFC.selector.prepickIfcItemsByID(0, [node.expressID]);
    }

    childNode.onclick = async () => {
        viewer.IFC.selector.pickIfcItemsByID(0, [node.expressID]);
    }
}

const scene = viewer.context.getScene();

// Gets the name of a category
function getName(category) {
	const names = (categories_0);
    return names[categories_0_ids.indexOf(category)];
}

// Gets all the items of a category
async function getAll(category) {
	return viewer.IFC.loader.ifcManager.getAllItemsOfType(0, category, false);
}

// Creates a new subset containing all elements of a category
async function newSubsetOfType(category) {
	const ids = await getAll(category);
	return viewer.IFC.loader.ifcManager.createSubset({
		modelID: 0,
		scene,
		ids,
		removePrevious: true,
		customID: category.toString(),
	});
}

const categories_0 = [];
const categories_0_ids = [];

// Stores the created subsets
const subsets = {};

async function getCategories(ifcProject, categories_0, categories_0_ids) {
    if (!(categories_0.includes(ifcProject.type))){
        categories_0.push(ifcProject.type);

        id = await viewer.IFC.loader.ifcManager.ifcAPI.GetTypeCodeFromName(0, ifcProject.type);
        categories_0_ids.push(id);
    }
    ifcProject.children.forEach(child => {
        getCategories(child, categories_0, categories_0_ids);
    })
}

async function setupAllCategories(ifcProject) {
    await getCategories(ifcProject, categories_0, categories_0_ids);
    console.log(categories_0);
    console.log(categories_0_ids);

	const allCategories = categories_0_ids;
    // console.log(allCategories);
    for (let i = 0; i < allCategories.length; i++) {
		const category = allCategories[i];
		await setupCategory(category);
	}
}

// Creates a new subset and configures the checkbox
async function setupCategory(category) {
	subsets[category] = await newSubsetOfType(category);
	setupCheckBox(category);
}

// Sets up the checkbox event to hide / show elements
function setupCheckBox(category) {
	const name = getName(category);
    checkBox_container = document.getElementsByClassName('checkboxes')[0];

    checkBox_div = document.createElement('div');
    
    checkBox = document.createElement('input');
    checkBox.type = "checkbox";
    checkBox_div.textContent = name;
    checkBox.checked = true;

    checkBox_div.appendChild(checkBox);
    checkBox_container.appendChild(checkBox_div);

	// const checkBox = document.getElementById(name);
	checkBox.addEventListener('change', (event) => {
		const checked = event.target.checked;
		const subset = subsets[category];
		if (checked) scene.add(subset);
		else subset.removeFromParent();
	});
}

//Sets up the IFC loading
const ifcLoader = viewer.IFC.loader;

async function setUpMultiThreading() {
    const manager = ifcLoader.ifcManager;
    // These paths depend on how you structure your project
    await manager.useWebWorkers(true, '../IFCWorker.js');
}

setUpMultiThreading();

function setupProgressNotification() {
    const text = document.getElementById('progress-text');
    ifcLoader.ifcManager.setOnProgress((event) => {
      const percent = event.loaded / event.total * 100;
        const result = Math.trunc(percent);
        text.innerText = result.toString();
    });
}

setupProgressNotification();