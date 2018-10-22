let controlsDiv, resultsDiv, verifDiv
let controls = {}
let playersToFollow
let gamesNames
let players
let groups = 0
let error = 0
let errors
let ofSize = 0
let forRounds = 0
let playerNames = []
let forbiddenPairs = Immutable.Set()
let gamesFirst
let gamesNext

let lastResults
const myWorker = new Worker('lib/worker.js');

function init() {
  myWorker.addEventListener('message', onResults, false);

  controlsDiv = document.getElementById('controls')
  resultsDiv = document.getElementById('results')
  verifDiv = document.getElementById('verifs')
  gamesNext = document.getElementById('gamesNext').textContent
  gamesFirst = document.getElementById('gamesFirst').textContent
  if (gamesFirst) {
    gamesFirst = gamesFirst.split('\n')
      .map(stringPair =>
        stringPair
        .split(',')
        .map(name => name.trim())
      )
  }

  if (gamesNext) {
    gamesNext = gamesNext.split('\n')
      .map(stringPair =>
        stringPair
        .split(',')
        .map(name => name.trim())
      )
  }

  controls.groupsLabel = controlsDiv.querySelector('#groupsLabel')
  controls.groupsSlider = controlsDiv.querySelector('#groupsSlider')
  controls.ofSizeLabel = controlsDiv.querySelector('#ofSizeLabel')
  controls.ofSizeSlider = controlsDiv.querySelector('#ofSizeSlider')
  controls.forRoundsLabel = controlsDiv.querySelector('#forRoundsLabel')
  controls.forRoundsSlider = controlsDiv.querySelector('#forRoundsSlider')
  controls.playerNames = controlsDiv.querySelector('#playerNames')
  controls.forbiddenPairs = controlsDiv.querySelector('#forbiddenPairs')
  controls.numberGames = controlsDiv.querySelector('#forGamesSlider')

  // User input controls
  controls.groupsSlider.oninput = onSliderMoved
  controls.ofSizeSlider.oninput = onSliderMoved
  controls.forRoundsSlider.oninput = onSliderMoved
  controls.playerNames.onkeyup = onPlayerNamesKeyUp
  controls.playerNames.onchange = onPlayerNamesChanged
  controls.forbiddenPairs.onchange = onForbiddenPairsChanged

  playerNames = readPlayerNames()
  forbiddenPairs = readForbiddenPairs(playerNames)
  onSliderMoved()

  document.getElementById('btn1').onclick = () => {
    lastResults = null;
    gamesNames = gamesFirst
    renderResults()
    disableControls()
    myWorker.postMessage({
      groups,
      ofSize,
      forRounds,
      forbiddenPairs: forbiddenPairs.toJS()
    })
  }
  document.getElementById('btn2').onclick = () => {
    lastResults = null;
    gamesNames = gamesNext
    renderResults()
    disableControls()
    myWorker.postMessage({
      groups,
      ofSize,
      forRounds,
      forbiddenPairs: forbiddenPairs.toJS()
    })
  }
}

function onResults(e) {
  lastResults = e.data
  renderResults()
  if (lastResults.done) {
    enableControls()
  }
}

function onSliderMoved() {
  groups = parseInt(controls.groupsSlider.value, 10)
  ofSize = parseInt(controls.ofSizeSlider.value, 10)
  forRounds = parseInt(controls.forRoundsSlider.value, 10)

  // Update labels
  controls.groupsLabel.textContent = groups
  controls.ofSizeLabel.textContent = ofSize
  controls.forRoundsLabel.textContent = forRounds
}

function disableControls() {
  controls.groupsSlider.disabled = true
  controls.ofSizeSlider.disabled = true
  controls.forRoundsSlider.disabled = true
  controls.playerNames.disabled = true
  controls.forbiddenPairs.disabled = true
}

function enableControls() {
  controls.groupsSlider.disabled = false
  controls.ofSizeSlider.disabled = false
  controls.forRoundsSlider.disabled = false
  controls.playerNames.disabled = false
  controls.forbiddenPairs.disabled = false
}


function createGames() {
  const N = Array(parseInt(controls.numberGames.value)).fill(null)
  return N.map((_, i) => `Game ${i}`)
}

function readPlayerNames() {
  const games = createGames()
  return games.concat(controls.playerNames.value
    .split('\n')
    .map(name => name.trim()))
}

function createPairsOfGames() {
  const games = createGames()
  const pairs = []
  games.forEach((_, idx1) => {
    games.forEach((_, idx2) => {
      if (idx2 > idx1)
        pairs.push([`Game ${idx1}`, `Game ${idx2}`])
    })
  })
  return pairs
}

function onPlayerNamesKeyUp() {
  playerNames = readPlayerNames()

}

function onPlayerNamesChanged() {
  playerNames = readPlayerNames()
  const newForbiddenPairs = readForbiddenPairs(playerNames)
  if (!forbiddenPairs.equals(newForbiddenPairs)) {
    forbiddenPairs = newForbiddenPairs
  }
}

function onForbiddenPairsChanged() {
  forbiddenPairs = readForbiddenPairs(playerNames)
}

/**
 * Given the current playerNames and the value of the forbiddenPairs input field,
 * recomputes the cached set of forbiddenPairs by index.
 * @param {Array<string>} playerNames
 * @return {Immutable.Set<Immutable.Set<number>>}
 */
function readForbiddenPairs(playerNames) {
  const pairsOfGames = createPairsOfGames()
  const res = controls.forbiddenPairs.value
    .split('\n')
    .map(stringPair =>
      stringPair
      .split(',')
      .map(name => name.trim())
    )
    .filter(pair => pair.length === 2)
    .concat(pairsOfGames)
    .reduce((memo, [leftName, rightName]) => {
      const leftIndices = indicesOf(leftName, playerNames)
      const rightIndices = indicesOf(rightName, playerNames)
      for (const leftIndex of leftIndices) {
        for (const rightIndex of rightIndices) {
          if (leftIndex !== rightIndex) {
            memo = memo.add(Immutable.Set([leftIndex, rightIndex]))
          }
        }
      }
      return memo
    }, Immutable.Set())
  return res
}

function indicesOf(needle, haystack) {
  const indices = []
  let nextIndex = -1
  do {
    nextIndex = haystack.indexOf(needle, nextIndex + 1)
    if (nextIndex > -1) indices.push(nextIndex)
  } while (nextIndex > -1)
  return indices
}

function renderResults() {
  if (!lastResults) {
    resultsDiv.innerHTML = 'Thinking...'
    return
  }
  resultsDiv.innerHTML = ''

  players = {}
  Array(parseInt(controls.numberGames.value + 36)).fill(null).forEach((_, idx) => {
    if (idx > 5) {
      players[idx] = []
    }
  })
  if (!playersToFollow && !Array.isArray(playersToFollow)) {
    playersToFollow = [Math.round(Math.random() * 30 + 6), Math.round(Math.random() * 30 + 6), Math.round(Math.random() * 30 + 6)]
  }
  lastResults.rounds.forEach((round, roundIndex) => {
    error = 0
    errors = []
    const roundDiv = document.createElement('div')
    roundDiv.classList.add('round')

    const header = document.createElement('h1')
    header.textContent = `Round ${roundIndex+1}`
    const conflictScore = document.createElement('div')
    conflictScore.classList.add('conflictScore')
    conflictScore.textContent = `Conflict score: ${lastResults.roundScores[roundIndex]}`
    header.appendChild(conflictScore)

    const groups = document.createElement('div')
    groups.classList.add('groups')


    round.forEach((group, groupIndex) => {
      const groupDiv = document.createElement('div')
      groupDiv.classList.add('group')
      const groupName = document.createElement('h2')
      const sorted = group.sort((a, b) => parseInt(a) < parseInt(b) ? -1 : 1)
      const game = sorted.filter((personNumber) => (playerNames[personNumber] || `Player ${personNumber + 1}`).indexOf("Game") === 0)[0]
      groupName.textContent = `${gamesNames[game]}`
      groupDiv.appendChild(groupName)

      const members = document.createElement('ul')
      sorted.forEach(personNumber => {
        const member = document.createElement('li')
        let text = playerNames[personNumber] ? playerNames[personNumber] : `Player ${personNumber + 1}`
        if (players[personNumber]) {
          if (game && players[personNumber] && players[personNumber].indexOf(game) > -1) {
            error += 1
            errors.push(personNumber)
          }
          players[personNumber].push(game)
        }
        if (players[personNumber] && playersToFollow.indexOf(personNumber) > -1) {

          text = `<b style="color:red">${text}</b>`
        }



        if (text.indexOf("Game") === -1) {
          member.innerHTML = text
          members.appendChild(member)
        }

      })
      groupDiv.appendChild(members)

      groups.appendChild(groupDiv)
    })


    roundDiv.appendChild(header)
    roundDiv.appendChild(groups)
    resultsDiv.appendChild(roundDiv)
  })
  verifDiv.innerHTML = ''
  playersToFollow.forEach((c) => {
    const member = document.createElement('p')
    member.textContent = `Player ${(+c)+1} plays ${players[c]}`
    verifDiv.appendChild(member)
  })
  const member = document.createElement('p')
  member.innerHTML = `<b style="color:red">Error ${error}, ${errors}</b>`
  verifDiv.appendChild(member)
}

document.addEventListener('DOMContentLoaded', init)