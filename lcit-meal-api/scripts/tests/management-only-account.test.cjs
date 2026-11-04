const {test}=require('node:test');
const assert=require('node:assert/strict');
let writes=0;
const dbPath=require.resolve('../../src/config/database');
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{query:async(sql,params)=>{
  if(sql.startsWith('SELECT username')) return [[{username:params[0]===53?'quanly':'cuongkm'}]];
  writes++; return [{affectedRows:1,insertId:10}];
}}};
const Repository=require('../../src/repos/MealRegistrationRepository');
test('Management-only account cannot create or reactivate a staff meal',async()=>{
  const repo=new Repository();
  repo.get=async()=>({id:10,userId:53});
  await assert.rejects(repo.create({userId:53,mealId:1}),{statusCode:409});
  await assert.rejects(repo.update(10,{status:'confirmed'}),{statusCode:409});
  await assert.rejects(repo.updateStatus(10,'completed'),{statusCode:409});
  assert.equal(writes,0);
  await repo.updateStatus(10,'cancelled');
  assert.equal(writes,1);
  await repo.assertMealParticipant(2);
});
