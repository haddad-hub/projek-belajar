(function(){
  const STORAGE_KEY='bonjek_ops_data_v1';
  const DEFAULT_DATA={orders:[],finance:[],couriers:[]};

  function clone(value){return JSON.parse(JSON.stringify(value));}
  function today(){
    const date=new Date();
    const year=date.getFullYear();
    const month=String(date.getMonth()+1).padStart(2,'0');
    const day=String(date.getDate()).padStart(2,'0');
    return `${year}-${month}-${day}`;
  }
  function read(){
    try{
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(!saved)return clone(DEFAULT_DATA);
      return {
        orders:Array.isArray(saved.orders)?saved.orders:[],
        finance:Array.isArray(saved.finance)?saved.finance:[],
        couriers:Array.isArray(saved.couriers)?saved.couriers:[]
      };
    }catch(error){
      return clone(DEFAULT_DATA);
    }
  }
  function write(data){
    localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('bonjek:datachange',{detail:data}));
  }
  function makeId(prefix){
    return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7).toUpperCase();
  }
  function money(value){return Math.max(0,Number(value||0));}
  function upsertCourier(profile){
    const data=read();
    const courier={
      id:profile.id||'KURIR-UTAMA',
      username:(profile.username||'').trim(),
      name:(profile.name||'Kurir Bonjek').trim(),
      phone:(profile.phone||'').trim(),
      vehicle:(profile.vehicle||'Motor').trim(),
      photo:profile.photo||''
    };
    const index=data.couriers.findIndex(item=>item.id===courier.id);
    if(index>=0)data.couriers[index]=courier;else data.couriers.push(courier);
    write(data);
    return courier;
  }
  function createOrder(input){
    const data=read();
    const orderDate=input.date||today();
    const order={
      id:makeId('ORD'),
      date:orderDate,
      createdAt:orderDate+'T'+new Date().toTimeString().slice(0,8),
      customerId:(input.customerId||'').trim(),
      customerUsername:(input.customerUsername||'').trim(),
      customerName:(input.customerName||'Pelanggan').trim(),
      customerPhone:(input.customerPhone||'').trim(),
      item:(input.item||'Pesanan').trim(),
      category:(input.category||'Makanan').trim(),
      qty:Math.max(1,Number(input.qty||1)),
      pickup:(input.pickup||'').trim(),
      dropoff:(input.dropoff||'').trim(),
      note:(input.note||'').trim(),
      status:'new',
      courierId:'',
      courierName:'',
      revenue:0,
      completedAt:''
    };
    data.orders.unshift(order);
    write(data);
    return order;
  }
  function acceptOrder(orderId,courier){
    const data=read();
    const order=data.orders.find(item=>item.id===orderId);
    if(!order||order.status!=='new')return null;
    const savedCourier=upsertCourier(courier||{});
    const fresh=read();
    const target=fresh.orders.find(item=>item.id===orderId);
    if(!target||target.status!=='new')return null;
    target.status='accepted';
    target.courierId=savedCourier.id;
    target.courierName=savedCourier.name;
    target.acceptedAt=new Date().toISOString();
    write(fresh);
    return target;
  }
  function completeOrder(orderId,amount){
    const data=read();
    const order=data.orders.find(item=>item.id===orderId);
    if(!order||order.status!=='accepted')return null;
    const nominal=money(amount);
    order.status='awaiting_confirmation';
    order.revenue=nominal;
    order.arrivedAt=new Date().toISOString();
    order.date=order.date||today();
    write(data);
    return order;
  }
  function confirmOrder(orderId){
    const data=read();
    const order=data.orders.find(item=>item.id===orderId);
    if(!order||order.status!=='awaiting_confirmation')return null;
    const nominal=money(order.revenue);
    order.status='completed';
    order.completedAt=new Date().toISOString();
    order.date=order.date||today();
    const exists=data.finance.some(item=>item.orderId===order.id&&item.type==='income');
    if(exists){
      write(data);
      return order;
    }
    data.finance.unshift({
      id:makeId('FIN'),
      orderId:order.id,
      date:order.date,
      category:'Pembayaran Order',
      type:'income',
      amount:nominal,
      note:'Pembayaran '+order.item+' oleh '+order.customerName,
      courierId:order.courierId,
      courierName:order.courierName
    });
    write(data);
    return order;
  }
  function toAnalyticsPayload(){
    const data=read();
    return {
      orders:data.orders.map(order=>({
        id:order.id,
        date:order.date,
        createdAt:order.createdAt,
        completedAt:order.completedAt,
        customerId:order.customerId,
        customerUsername:order.customerUsername,
        customerName:order.customerName,
        customerPhone:order.customerPhone,
        item:order.item,
        category:order.category,
        qty:order.qty,
        pickup:order.pickup,
        dropoff:order.dropoff,
        note:order.note,
        courierId:order.courierId,
        courier:order.courierName||'Belum Diambil',
        courierName:order.courierName,
        status:order.status,
        revenue:money(order.revenue)
      })),
      finance:data.finance,
      couriers:data.couriers
    };
  }
  window.BonjekStore={STORAGE_KEY,read,write,createOrder,acceptOrder,completeOrder,confirmOrder,upsertCourier,toAnalyticsPayload};
})();
