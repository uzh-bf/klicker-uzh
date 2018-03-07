// convert an integer index into letters
export const indexToLetter = (index) => {
  // calculate how many times the letter should be repeated
  // eg. 0 => A (times= 1), 24 => AA (times = 2),
  const n = Math.floor(index / 24) + 1

  // index: letter
  // 65: A, 66: B , ...
  // return n times a letter from A to Z
  return Array(n + 1).join(String.fromCharCode(65 + index % 24))
}
