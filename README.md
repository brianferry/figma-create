# Figma Tokens javascript action

This action creates tokens in a Figma file from a JSON style-dictionary file.

## Inputs

### `figma_file`

**Required** The Figma file ID where the tokens will be created.

### `figma_token`

**Required** The Figma API token.

## `collections`

**Optional** The collections to create in the Figma file. Default `{"semantic": {"name": "Semantic Colors", "modeId": "semantic-light", "secondaryModeId": "semantic-dark"}, "default": {"name": "General", "modeId": "default"}}`.

### `style_dictionary_url`

**Required** The url of the style-dictionary file that will be used to create the tokens.

## Example usage

```yaml
uses: brianferry/figma-create@v1.0
with:
  figma_file: 'your-figma-file-id'
  figma_token: ${{ secrets.FIGMA_TOKEN }}
  style_dictionary_url: 'https://raw.githubusercontent.com/your-repo/your-branch/style-dictionary.json'
```