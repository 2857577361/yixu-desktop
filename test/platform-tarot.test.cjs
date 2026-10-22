const {test}=require('node:test'),assert=require('node:assert/strict');
const {dataDirectory}=require('../platform.cjs'),Tarot=require('../ui/tarot-engine.js');
test('platform data paths preserve Mac and use Windows roaming profile',()=>{
 assert.equal(dataDirectory('darwin',{},'/Users/example'),'/Users/example/Library/Application Support/Yixu');
 assert.equal(dataDirectory('win32',{APPDATA:'C:\\Users\\A\\AppData\\Roaming'},'C:\\Users\\A'),'C:\\Users\\A\\AppData\\Roaming\\Yixu');
 assert.equal(dataDirectory('win32',{},'C:\\Users\\A'),'C:\\Users\\A\\AppData\\Roaming\\Yixu');
 assert.equal(dataDirectory('linux',{XDG_DATA_HOME:'/tmp/share'},'/home/a'),'/tmp/share/Yixu');
 assert.equal(dataDirectory('darwin',{YIXU_DATA_DIR:'/tmp/yixu-test'},'/Users/a'),'/tmp/yixu-test');
});
test('tarot full deck has 78 distinct meaningful cards',()=>{assert.equal(Tarot.deck.length,78);assert.equal(new Set(Tarot.deck.map(c=>c.id)).size,78);assert.equal(Tarot.deck.filter(c=>c.suit==='major').length,22);for(const c of Tarot.deck){assert.ok(c.upright.length>15);assert.ok(c.reversed.length>15);assert.notEqual(c.upright,c.reversed);}});
test('draw never repeats a card and orientation chooses the matching interpretation',()=>{
 for(let i=0;i<500;i++){const cards=Tarot.draw(3);assert.equal(new Set(cards.map(c=>c.id)).size,3);for(const c of cards)assert.equal(Tarot.text(c),c.isReversed?c.reversed:c.upright);}
 assert.ok(Tarot.draw(1,()=>0)[0].isReversed);assert.ok(!Tarot.draw(1,()=>.999999)[0].isReversed);assert.throws(()=>Tarot.draw(78));assert.throws(()=>Tarot.text({id:'fake'}));
});
test('journal export includes prompt, each drawn card, interpretation and reflection',()=>{const cards=Tarot.draw(3,()=>.8),s=Tarot.markdown({cards,question:'接下来怎么学？',reflection:'先读一页'});assert.ok(s.includes('接下来怎么学？'));assert.ok(s.includes('先读一页'));for(const c of cards){assert.ok(s.includes(c.name));assert.ok(s.includes(Tarot.text(c)));}assert.ok(s.includes('趣味抽牌'));});
