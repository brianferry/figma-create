/** **************************************************************************************************************/
/*                                                                                                              */
/* This script is used to convert the RHDS tokens into a format that can be sent to the Figma REST API.         */
/* The script will loop through the tokens and create collections, modes, and tokens that can be used in Figma. */
/* Figma API Documentation: https://www.figma.com/developers/api                                                */
/*                                                                                                              */
/** *************************************************************************************************************/

const collections = {};
const styleDictionaryTokens = {};

// The figmaApiPayload object is used to store the data that will be sent to the Figma API.
const figmaApiPayload = {
  variableCollections: [],
  variables: [],
  variableModes: [],
  variableModeValues: []
};

// Loop through the collections and format them to be used in the Figma API.
const createCollections = () => {
  /**
    * Standard format for creating a collection in Figma API
    * {
    *   action (CREATE, UPDATE, DELETE)
    *   id (name of the collection)
    *   name (name of the collection)
    *   initialModeId (the mode that the collection will be created with)
    * }
    */
  Object.entries(collections).forEach(([, { name, modeId, secondaryModeId }]) => {
    figmaApiPayload.variableCollections.push({
      action: 'CREATE',
      id: name,
      name,
      initialModeId: modeId,
    });
    // If a secondary mode exists, create it. This is used for dark mode in the Semantic color collection.
    if (secondaryModeId) {
      createSecondaryMode(secondaryModeId, name);
    }
  });
};

// Create a secondary mode for the named collection.  This is used for dark mode in the Semantic color collection.
const createSecondaryMode = (name, variableCollectionId) => {
  /**
   * Standard format for creating a mode
   * {
   *  action
   *  name
   *  variableCollectionId
   * }
   */
  figmaApiPayload.variableModes.push({
    action: 'CREATE',
    id: name,
    name,
    variableCollectionId,
  });
};

// For semantic colors, we need to create a token for each color that has a semantic meaning.
const createSemanticToken = (name, type, path, value, stringMatch, codeSyntax) => {
  if (name.match(stringMatch)) {
    // Get whether the theme is light or dark
    const theme = name.match(/light(er|est)?|white/) ? collections.semantic.modeId : name.match(/dark(er|est)?|black/) ? collections.semantic.secondaryModeId : undefined;

    // Fixing up the name
    //
    name = name.replace(/light(er|est)?|white/, '');
    name = name.replace(/dark(er|est)?|black/, '');
    name = name.replace(/-$/, '');
    name = name.replace(/-on$/, '');

    createToken(
      collections.semantic.name,
      theme,
      type,
      `${path}/${name}`,
      value,
      codeSyntax
    );
  }
};

const createToken = (
  variableCollectionId,
  modeId,
  resolvedType,
  name,
  value,
  codeSyntax
) => {
  /**
   * Standard format for creating a mode value
   * {
   *  variableId,
   *  modeId,
   *  value
   * }
   */
  figmaApiPayload.variableModeValues.push({
    variableId: name,
    modeId,
    value,
  });

  /**
    * Standard format for creating a token
    * {
    *   action,
    *   id,
    *   name,
    *   resolvedType, (COLOR, STRING, FLOAT)
    *   variableCollectionId (name of the collection)
    *   codeSyntax (what the code should look like when using the token, e.g. var(--token-name, #000000))
    * }
    */
  figmaApiPayload.variables.push({
    action: 'CREATE',
    id: name,
    name,
    resolvedType,
    variableCollectionId,
    codeSyntax
  });
};

const getCodeSyntax = (object, type, key) => {
  // If the token is a color, we need to use the hex value to create the code syntax.
  if (object.name) {
    if (type === 'COLOR') {
      return {
        'WEB': `var(--${object.name}, #${object.attributes?.hex || '000000'})`
      };
    } else {
      // For all other tokens, we can use the value of the token to create the code syntax.
      return {
        'WEB': `var(--${object.name}, ${object.$value.toString()})`
      };
    }
  } else {
    const formattedKey = key.replace(/\//g, '-');
    return {
      'WEB': `var(--${formattedKey}, ${object.$value.toString()})`
    };
  }
};

const getCollection = (object, key) => {
  const type = key?.split('/')[0];
  // If the token has a category or type, we can use that to determine which collection it belongs to.
  if (object.attributes?.category && collections[object.attributes?.category]) {
    return collections[object.attributes.category];
  } else if (object.attributes?.type && collections[object.attributes?.type]) {
    return collections[object.attributes.type];
  } else if (object.attributes?.category.includes('font') || object.attributes?.type.includes('font')) {
    return collections['font'];
  } else if (type && collections[type]) {
    return collections[type];
  }
  return collections.default;
};

const getColorTheme = object => {
  // If the token name contains 'light' or 'dark', we can use that to determine the theme.
  if (object.name?.toString().match(/(light|dark)$/)) {
    const [theme] = object.name.toString().match(/(light|dark)$/);
    return theme;
  }
  return undefined;
};

const getTokenCategory = object => {
  // If the token has a category or type, we can use that to determine which category it belongs to.
  if (object.attributes?.category && collections[object.attributes?.category]) {
    return object.attributes.category;
  } else if (object.attributes?.type && collections[object.attributes?.type]) {
    return object.attributes.type;
  }
  return 'default';
};

const getTokenType = (type, object) => {
  // We support three types of tokens: FLOAT, COLOR, and STRING.  If the token is a number, we can assume it is a FLOAT.
  if (object.$value.toString().match(/(px|rem)$/) || type === 'number') {
    return 'FLOAT';
  } else if (type === 'color') {
    return 'COLOR';
  }
  return 'STRING';
};

const getTokenValue = (type, collection, object) => {
  // Depending on the type of token, we need to parse the value differently.
  if (object.original?.$value !== undefined && object.original?.$value.toString().indexOf('{') > -1) {
    return parseTokenValue(object.original.$value);
  }
  if (type === 'FLOAT') {
    return parseFloatValue(collection, object.$value.toString());
  } else if (type === 'COLOR') {
    return parseColor(object?.attributes?.hex || object.$value.toString());
  }
  if (collection.modeId === 'line-height') {
    return parseLineHeight(object.$value.toString());
  }
  return object?.$value.toString();
};

const parseCollectionsByCategory = () => {
  // Loop through the tokens and look for the top-level keys.  We will use these as the collection names.
  Object.entries(styleDictionaryTokens).forEach(([key]) => {
    if (key) {
      // If a key doesn't exist yet, add it.
      if (!collections[key]) {
        // Replace all hyphens with spaces and capitalize the first letter of each word.  e.g. 'color-palette' => 'Color Palette'
        const name = key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        collections[key] = {
          name,
          modeId: key,
        };
      }
    }
  });
};

const parseColor = color => {
  if (color.substring(0, 1) === '#') {
    color = color.substring(1);
  }
  // We need to convert the hex value to RGB values.
  const _color = color.trim();
  const expandedHex =
      _color.length === 3 ?
        _color
          .split('')
          .map(char => char + char)
          .join('')
        : _color;
  return {
    r: parseInt(expandedHex.slice(0, 2), 16) / 255,
    g: parseInt(expandedHex.slice(2, 4), 16) / 255,
    b: parseInt(expandedHex.slice(4, 6), 16) / 255,
  };
};

const parseFloatValue = (collection, value) => {
  // If the collection is for letter spacing, we need to convert the value to pixels.
  if (collection.modeId === 'letter-spacing') {
    return Number.parseFloat(value) * 16;
  }
  // If the value is a number followed by 'px' or 'rem', we need to remove the measurement and convert it to a number.
  let measurement = undefined;
  [measurement] = value.match(/(px|rem)$/);
  if (measurement) {
    return Number.parseFloat(value.replace(measurement[0], ''));
  }
  return value;
};

const parseLineHeight = value => {
  return `${(Number.parseFloat(value) * 16).toString()}px`;
};

const parseTokenValue = value => {
  const modifiableValue = value.toString().replace('{', '').replace('}', '');
  const originalValue = modifiableValue.replaceAll('.', '-').toString();
  const originalPath = modifiableValue.split('.').slice(0, -1).join('/');

  return {
    id: `${originalPath}/--rh-${originalValue}`,
    type: 'VARIABLE_ALIAS'
  };
};

const traverseToken = (type, key, object) => {
  type = type || object?.$type;
  if (key.charAt(0) === '$') {
    return;
  }
  if (object?.$value !== undefined) {
    // Grab the token type, category, collection, code syntax, and value.
    const tokenType = getTokenType(type, object);
    const tokenCategory = getTokenCategory(object);
    const collection = getCollection(object, key);
    const codeSyntax = getCodeSyntax(object, tokenType, key);
    const tokenValue = getTokenValue(tokenType, collection, object);
    if (tokenType === 'COLOR') {
      // If the token is a color, we need to determine if it has a theme.  If it does, we need to create a semantic token as well.
      const colorTheme = getColorTheme(object);
      if (colorTheme) {
        createToken(
          collection.name,
          tokenCategory, // 'default' is the modeId for color collection
          tokenType,
          `${object.path?.slice(0, -1).join('/')}/${colorTheme ? `${colorTheme}/` : ''}--${object?.name}`,
          tokenValue,
          codeSyntax
        );
        createSemanticToken(
          object.name,
          tokenType,
          object.path?.slice(0, -1).join('/'),
          tokenValue,
          /(light|dark)$/,
          codeSyntax
        );
      }
      if (object.name?.toString().match(/(white|black)$/)) {
        createSemanticToken(
          object.name,
          tokenType,
          object.path?.slice(0, -1).join('/'),
          tokenValue,
          /(white|black)$/,
          codeSyntax
        );
      }
    }
    createToken(
      collection.name,
      collection.modeId,
      tokenType,
      // Join all items in an array except the last one
      object.path ? `${object.path?.slice(0, -1).join('/')}/--${object?.name}` : key,
      tokenValue,
      codeSyntax
    );
  } else {
    if (typeof object !== 'undefined') {
      Object.entries(object).forEach(([key2, object2]) => {
        if (key2.charAt(0) !== '$') {
          traverseToken(
            type,
            `${key}/${key2}`,
            object2,
          );
        }
      });
    }
  }
};

const removeUnusedCollections = () => {
  // If any collections are not used, remove them from the payload.
  const usedCollections = figmaApiPayload.variables.map(variable => variable.variableCollectionId);
  const uniqueCollections = [...new Set(usedCollections)];
  figmaApiPayload.variableCollections = figmaApiPayload.variableCollections.filter(collection => uniqueCollections.includes(collection.id));
};

const loopTokens = () => {
  Object.entries(styleDictionaryTokens).forEach(([key, value]) => {
    traverseToken(
      styleDictionaryTokens.$type,
      key,
      value,
    );
  });
};

const writeOutputToFile = async (payload) => {
  // For debugging purposes, we can write the output to a file.
  const fs = require('fs');
  const path = require('path');
  const outputDir = path.join(__dirname, '../build');
  const outputFileName = 'figma.output.json';
  const outputFilePath = path.join(outputDir, outputFileName);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  fs.writeFileSync(outputFilePath, JSON.stringify(payload, null, 2));
};

const sendPayloadToFigma = async (body, apiToken, fileId) => {
  return await fetch(
    `https://api.figma.com/v1/files/${fileId}/variables`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'X-FIGMA-TOKEN': apiToken,
        'Content-Type': 'application/json',
      },
    }).then(response => response.json());
};

const figmaConvertToPayload = async (_collections, _styleDictionary) => { 
  Object.assign(collections, _collections);
  Object.assign(styleDictionaryTokens, _styleDictionary);

  parseCollectionsByCategory();
  createCollections();
  loopTokens();

  return figmaApiPayload;
};

module.exports = {
  figmaConvertToPayload,
  writeOutputToFile,
  sendPayloadToFigma,
};