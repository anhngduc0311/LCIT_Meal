const assert = require('node:assert/strict');
const { test } = require('node:test');
const dbPath = require.resolve('../../src/config/database');
const registrations = [
  ...Array.from({length:25},()=>({meal_date:'2001-01-03',full_name:'Kim Mạnh Cường',facility_id:null,guest_count:0})),
  ...Array.from({length:20},()=>({meal_date:'2001-01-03',full_name:'Other staff',facility_id:2,guest_count:0})),
  {meal_date:'2001-01-03',full_name:'Unknown staff',facility_id:null,guest_count:1},
];
require.cache[dbPath] = { id:dbPath,filename:dbPath,loaded:true,exports:{async query(sql) {
  if(sql.includes('setting_value')) return [[{setting_value:'12:00'}]];
  if(sql.includes('u.full_name')) {
    assert.match(sql,/mr.status='completed'/);
    assert.match(sql,/m.is_cancelled=0/);
    assert.match(sql,/m.status='active'/);
    return [registrations];
  }
  return [[{meal_date:sql.includes("'%Y-%m')") ? '2001-01' : '2001-01-03',is_cancelled:0,total_meal_slots:47,registered_staff_count:46}]];
}}};
const mealsPath = require.resolve('../../src/repos/MealRepository');
require.cache[mealsPath] = {id:mealsPath,filename:mealsPath,loaded:true,exports:class {
  async filterGuestCounts(){return [{mealDate:'2001-01-03',facilityId:1,guestCount:2},{mealDate:'2001-01-03',facilityId:2,guestCount:3}];}
}};
const Repository = require('../../src/repos/DashboardRepository');
const Service = require('../../src/services/DashboardService');
const Controller = require('../../src/controllers/DashboardController');
test('Week, month and year isolate site staff and linked/standalone guests',async()=>{
  const repo=new Repository();
  for(const period of ['week','month','year']) {
    for(const [facility,staff,total] of [[1,25,27],[2,20,23],['unassigned',1,2],[undefined,46,52]]) {
      const chart=await repo.getChartByPeriod(period,'2001-01-03',facility);
      const point=chart.data.find(p=>p.meal_date===(period==='year'?'2001-01':'2001-01-03'));
      assert.equal(point.registered_staff_count,staff);
      assert.equal(point.total_meal_slots,total);
    }
  }
});
test('Explicit facility assignment takes precedence over roster aliases',async()=>{
  registrations[0].facility_id=2;
  try {
    const result=await new Repository().getChartByPeriod('week','2001-01-03',1);
    assert.equal(result.data[0].registered_staff_count,24);
    assert.equal(result.data[0].total_meal_slots,26);
  } finally {registrations[0].facility_id=null;}
});
test('Chart service validates and normalizes facility filters',async()=>{
  const seen=[];
  const service=new Service({getChartByPeriod:async(...args)=>seen.push(args)});
  for(const facility of ['1','2','all','unassigned',undefined]) await service.getChart('week','2001-01-03',facility);
  assert.deepEqual(seen.map(args=>args[2]),[1,2,undefined,'unassigned',undefined]);
  await assert.rejects(service.getChart('week','2001-01-03','bad'),{statusCode:400});
});
test('Chart controller forwards selected facility and fixes kitchen scope to site one',async()=>{
  for(const [roles,expected] of [[['admin'],'2'],[[{code:'manager'}],'2'],[['kitchen'],1]]) {
    const controller=new Controller({getChart:async(period,date,facility)=>{assert.equal(facility,expected);return {};}});
    await controller.getChart({user:{roles},query:{period:'week',date:'2001-01-03',facilityId:'2'}},{status(){return this;},json(){}},error=>{throw error;});
  }
});
