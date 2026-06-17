async function check() {
  const res = await fetch('http://127.0.0.1:3000/');
  const text = await res.text();
  console.log(text);
}
check();
