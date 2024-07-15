# Figma Tokens javascript action

This action creates tokens in a Figma file from a JSON style-dictionary file.

## Inputs

### `figma_file`

**Required** The Figma file ID where the tokens will be created.

### `figma_token`

**Required** The Figma API token.

### `style_dictionary`

**Required** The path to the JSON style-dictionary file.

## Example usage

```yaml
uses: brianferry/figma-tokens@v1
with:
  figma_file: 'your-figma-file-id'
  figma_token: ${{ secrets.FIGMA_TOKEN }}
  style_dictionary: 'path/to/style-dictionary.json'
```