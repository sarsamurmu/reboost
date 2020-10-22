import './styles/index.scss';

document.body.append(...new DOMParser().parseFromString(/* html */`
  ${Array(20).fill('').map((_, i) => (
    `<p class="size-${i + 1}">Size ${i + 1}</p>`
  )).join('')}
`, 'text/html').body.children);
