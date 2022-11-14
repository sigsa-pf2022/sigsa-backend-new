export function random() {
  const number = Math.ceil(
    new Date().getTime() * Math.random() + Math.random(),
  );
  const initial = Math.floor(Math.random() * 3);
  const subNumber = Number(String(number).substring(initial, initial + 6));
  if (subNumber < 100000) {
    random();
  } else {
    return subNumber;
  }
}
