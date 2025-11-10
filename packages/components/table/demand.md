# 需求

- [x] key 值调整
组件库名称:组件名称:domain(冒号:转 urlcode %3a)/path#tableid
bsui:el-table:http%3A%2F%2Flocalhost:5173/hr/employee/list#testTable
- [x] checkbox、radio 列禁止拖动
3. 细节：固定列分区拖动到非固定列分区时，需要显示禁止的符号，反之亦然，同一分区内则使用默认的
- [x]. 细节：固定列分区拖动，如果固定列或非固定列分区只有一列时，直接不显示拖动的图标句柄
5. 实现列显示隐藏数据的持久化逻辑，可以暂时不实现 UI 来显示隐藏列，只实现数据持久化的逻辑
