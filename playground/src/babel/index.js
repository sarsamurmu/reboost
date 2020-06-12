const toDiv = (message) => {
  const div = document.createElement('div');
  div.innerText = message;
  return div;
}

'world'
  |> #.toUpperCase()
  |> ', ' + # + '!'
  |> 'Hello' + #
  |> toDiv
  |> document.body.appendChild;
