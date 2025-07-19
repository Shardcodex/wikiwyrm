module.exports = function infoboxPlugin(md) {
  function infoboxParser(state, startLine, endLine, silent) {
    const start = state.bMarks[startLine] + state.tShift[startLine]
    const max = state.eMarks[startLine]
    const line = state.src.slice(start, max)

    if (!line.startsWith('{infobox')) return false

    let content = ''
    let nextLine = startLine + 1

    while (nextLine < endLine) {
      const nextStart = state.bMarks[nextLine] + state.tShift[nextLine]
      const nextMax = state.eMarks[nextLine]
      const nextLineText = state.src.slice(nextStart, nextMax)

      if (nextLineText.trim() === '}') break

      content += nextLineText + '\n'
      nextLine++
    }

    const token = state.push('infobox_open', 'div', 1)
    token.attrs = [['class', 'infobox']]

    // Parse each key:value
    content.split('\n').forEach(line => {
      const match = line.match(/^(\w+):\s*(.+)$/)
      if (match) {
        const t = state.push('html_inline', '', 0)
        t.content = `<div><strong>${match[1]}:</strong> ${match[2]}</div>`
      }
    })

    state.push('infobox_close', 'div', -1)
    state.line = nextLine + 1

    return true
  }

  md.block.ruler.before('fence', 'infobox', infoboxParser)
}
