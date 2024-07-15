const core = require('@actions/core');
const github = require('@actions/github');
const { figmaConvertToPayload, sendPayloadToFigma, writeOutputToFile } = require('./scripts/figma.cjs');

async function main() {
    // 'figma_file' input defined in action.yml
    const figmaFile = core.getInput('figma_file');
    // 'figma_token' input defined in action.yml
    const figmaToken = core.getInput('figma_token');
    // 'collections' input defined in action.yml
    const collections = JSON.parse(core.getInput('collections'));
    // 'style_dictionary_url' input defined in action.yml
    const styleDictionaryUrl = core.getInput('style_dictionary_url');
    // Get the JSON data from the remote style dictionary url
    const styleDictionaryData = await fetch(styleDictionaryUrl).then(response => response.json());

    const payload = await figmaConvertToPayload(collections, styleDictionaryData);

    await writeOutputToFile(payload);

    if (figmaFile && figmaToken) {
        const result = await sendPayloadToFigma(payload, figmaToken, figmaFile);
        console.log(result);
        return result;
    }
}

try {
  main();
} catch (error) {
    core.setFailed(error.message);
} 