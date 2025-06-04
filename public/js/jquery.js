// Tiny jQuery-like helper used for demo purposes
window.$ = function(selector){
  const nodes = Array.from(document.querySelectorAll(selector));
  nodes.on = function(event, handler){
    this.forEach(n=>n.addEventListener(event, handler));
  };
  return nodes;
};
