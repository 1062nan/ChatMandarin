-- 003: 修复 RLS 策略 + 删除 ws 依赖
-- 在 Supabase SQL Editor 运行

-- 修复 hskk_tests：允许用户 INSERT 自己的记录
DROP POLICY IF EXISTS "Users can view own hskk_tests" ON hskk_tests;
CREATE POLICY "Users can CRUD own hskk_tests" ON hskk_tests
  FOR ALL USING (user_id IN (SELECT id FROM profiles WHERE auth_id = auth.uid()));

-- 修复 dubbing_performances：允许用户 INSERT
DROP POLICY IF EXISTS "Users can CRUD own dubbing performances" ON dubbing_performances;
CREATE POLICY "Users can CRUD own dubbing performances" ON dubbing_performances
  FOR ALL USING (user_id IN (SELECT id FROM profiles WHERE auth_id = auth.uid()));

-- 修复 shadowing_records：允许用户 INSERT
DROP POLICY IF EXISTS "Users can CRUD own shadowing records" ON shadowing_records;
CREATE POLICY "Users can CRUD own shadowing records" ON shadowing_records
  FOR ALL USING (user_id IN (SELECT id FROM profiles WHERE auth_id = auth.uid()));

-- 修复 conversation_turns：允许用户 INSERT（通过 conversation 关联）
DROP POLICY IF EXISTS "Users can view own turns" ON conversation_turns;
CREATE POLICY "Users can CRUD own turns" ON conversation_turns
  FOR ALL USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id IN (
        SELECT id FROM profiles WHERE auth_id = auth.uid()
      )
    )
  );
