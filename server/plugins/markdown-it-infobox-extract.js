module.exports = function infoboxExtractPlugin(md) {
  md.core.ruler.push('extract_infobox', function(state) {
    let infoboxContent = ''

    state.tokens = state.tokens.filter(token => {
      if (token.type === 'inline' && token.content.includes('{infobox')) {
        const match = token.content.match(/\{infobox([\s\S]*?)\}/)
        if (match) {
          infoboxContent = `<div class="infobox">${match[1].trim()}</div>`
          return false // Remove this from normal flow
        }
      }
      return true // Keep other tokens
    })

    // store on the markdown environment object
    state.env.infoboxContent = infoboxContent
  })
}
