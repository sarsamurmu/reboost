enum Platforms {
  BROWSER,
  NODEJS
}

const obj: any = {
  prop: 6
}

console.log(Platforms);
console.log(obj?.prop);
console.log(null ?? 7);
