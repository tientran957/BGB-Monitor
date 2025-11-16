async function loadMarket(){
  try{
    const r = await fetch("https://api.coingecko.com/api/v3/coins/bitget-token");
    const j = await r.json();
    document.getElementById("price").innerText = "$" + j.market_data.current_price.usd;
    document.getElementById("volume").innerText = "$" + j.market_data.total_volume.usd.toLocaleString();
  } catch(e){
    console.log("Price error");
  }
}
loadMarket();
setInterval(loadMarket, 30000);

function connectWS(){
  let proto = location.protocol === "https:" ? "wss" : "ws";
  let ws = new WebSocket(proto + "://" + location.host);

  ws.onmessage = ev => {
    let data = JSON.parse(ev.data);
    if(data.type === "orderbook"){
      document.getElementById("buy").innerText = "$" + data.buy.toLocaleString();
      document.getElementById("sell").innerText = "$" + data.sell.toLocaleString();
    }
    if(data.type === "alert"){
      let li = document.createElement("li");
      li.innerText = JSON.stringify(data.payload);
      document.getElementById("alerts").prepend(li);
    }
  };
  ws.onclose = () => setTimeout(connectWS, 3000);
}
connectWS();
