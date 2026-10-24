/* Anchor primitive — universal deep reference */

export function createAnchor(text, sourceLabel=""){
  // generate a text-fragment style anchor + snapshot hash
  const fragment = text.trim().slice(0,80).replace(/\s+/g," ").trim();
  const encoded = encodeURIComponent(fragment);
  const hash = simpleHash(text);
  const id = "anc_"+hash.slice(0,8);
  const anchor = {
    id, fragment, hash, sourceLabel,
    created: new Date().toISOString(),
    url: `#anchor=${encoded}&h=${hash}`,
  };
  // store locally
  const store = JSON.parse(localStorage.getItem("veritasAnchors")||"[]");
  store.unshift(anchor);
  localStorage.setItem("veritasAnchors", JSON.stringify(store.slice(0,50)));
  return anchor;
}

export function getAnchors(){
  return JSON.parse(localStorage.getItem("veritasAnchors")||"[]");
}

export function resolveAnchor(hash){
  const store = getAnchors();
  return store.find(a=>a.hash===hash) || null;
}

function simpleHash(str){
  let h=0;
  for(let i=0;i<str.length;i++){ h=((h<<5)-h)+str.charCodeAt(i); h=h&h; }
  return Math.abs(h).toString(16).padStart(8,"0");
}

export function highlightFragment(container, fragment){
  if(!fragment) return;
  const html = container.innerHTML;
  const idx = html.toLowerCase().indexOf(fragment.toLowerCase().slice(0,40));
  if(idx<0) return false;
  const before = html.slice(0,idx);
  const match = html.slice(idx, idx+fragment.length);
  const after = html.slice(idx+fragment.length);
  container.innerHTML = before + `<mark class="anchor-hl">${match}</mark>` + after;
  const mark = container.querySelector("mark.anchor-hl");
  if(mark) mark.scrollIntoView({behavior:"smooth",block:"center"});
  return true;
}