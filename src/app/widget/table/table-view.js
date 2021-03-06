ComponentJS.ns("___config.package___");
___config.package___.view = ComponentJS.clazz({
    mixin: [ComponentJS.marker.view],
    dynamics: {
        markupName: "___config.id___",
        grid: null,
        slickViewport: null,

        disableSlickevents: false,
        onBeforeEditCellCallback: false,
        onBeforeMoveRowsCallback: false,
        interruptCallback: null,
        clickOutsideCallback: null,
        interruptClickOutside: false,
        onBeforeMoveRows: null,
        onMoveRows: null,
        registeredPlugins: {}
    },
    protos: {

        render () {

            this.ui = $.markup(this.markupName, this.markupParams).localize();
            ComponentJS(this).plug({object: this.ui, spool: ComponentJS(this).state()});

            this.interruptCallback = this.interruptClickHandler.bind(this);
            this.clickOutsideCallback = this.clickOutsideHandler.bind(this);

            this.prepareTableRendering();
            this.prepareMaskReferences();
            this.registerCommandBindings();
            this.registerEventBindings();
            this.registerDataBindings();
            this.registerGridBindings();
        },

        release () {
            this.ui.unbind("mousedown", this.interruptCallback);
            $('body').unbind("mousedown", this.clickOutsideCallback);
            this.grid.destroy();
            this.grid = null;
        },

        prepareMaskReferences () {
            this.slickViewport = $(".slick-viewport", this.ui);
        },

        registerCommandBindings () {

            ComponentJS(this).observe({
                name: "command:renderGrid", spool: "materialized", boot: true,
                func: () => {
                    this.grid.invalidate();
                    this.registerAdditionalSlickEvents();
                }
            });

            ComponentJS(this).observe({
                name: "command:resizeGrid", spool: "materialized", boot: true,
                func: () => {
                    this.grid.resizeCanvas();
                    this.grid.invalidate();
                    this.registerAdditionalSlickEvents();
                }
            });

            if (ComponentJS(this).value("data:dataView")) {
                ComponentJS(this).observe({
                    name: "command:changeRowCount", spool: "materialized",
                    func: () => {
                        if (this.grid) {
                            this.grid.updateRowCount();
                            this.grid.render();
                        }
                    }
                });

                ComponentJS(this).observe({
                    name: "command:changedRows", spool: "materialized",
                    func: (ev, args) => {
                        if (this.grid && args) {
                            this.grid.invalidateRows(args.rows);
                            this.grid.render();
                            this.registerAdditionalSlickEvents();
                        }
                    }
                });
            }

            ComponentJS(this).observe({
                name: "command:setSelectedItems", spool: "materialized",
                func: (ev, selectedItems) => {
                    if (ComponentJS(this).value("data:options").activateRowSelectionModel) {
                        this.resetRowSelection();
                        if (selectedItems && selectedItems.length > 0) {
                            this.disableSlickevents = true;
                            this.grid.setSelectedRows(selectedItems);
                            this.disableSlickevents = false;
                        }
                    }
                }
            });

            ComponentJS(this).observe({
                name: "command:scrollRowToTop", spool: "materialized",
                func: (ev, row) => {
                    if (row >= 0) this.grid.scrollRowToTop(row);
                }
            });

            ComponentJS(this).observe({
                name: "command:scrollRowIntoView", spool: "materialized",
                func: (ev, row) => {
                    if (row >= 0) this.grid.scrollRowIntoView(row);
                }
            });

            ComponentJS(this).observe({
                name: "command:setOnBeforeEditCellCallback", spool: "materialized",
                func: (ev, callback) => {
                    this.onBeforeEditCellCallback = callback.onBeforeEditCellCallback;
                }
            });

            ComponentJS(this).observe({
                name: "command:setOnBeforeMoveRowsCallback", spool: "materialized",
                func: (ev, callback) => {
                    this.onBeforeMoveRowsCallback = callback.callback;
                }
            });

        },

        registerEventBindings () {
            this.slickViewport.bind("mousedown", this.interruptCallback);
            $('body').bind("mousedown", this.clickOutsideCallback);
        },

        registerDataBindings () {

            if (!ComponentJS(this).value("data:dataView")) {
                ComponentJS(this).observe({
                    name: "data:data", spool: "materialized",
                    func: (ev, data) => {
                        this.grid.setData(data);
                        this.grid.render();
                    }
                });
            }

            ComponentJS(this).observe({
                name: "data:columns", spool: "materialized",
                func: (ev, columns) => {
                    let cols = this.functionalColumns().concat(columns);
                    this.grid.setColumns(cols);
                    this.grid.render();
                    if (ComponentJS(this).value("data:options").activateRowSelectionModel) {
                        this.disableSlickevents = true;
                        this.grid.setSelectedRows(this.grid.getSelectedRows());
                        this.disableSlickevents = false;
                    }
                    this.registerAdditionalSlickEvents();
                }
            });


            ComponentJS(this).observe({
                name: "data:options", spool: "materialized", op: "changed",
                func: (ev, options) => {
                    this.grid.setOptions(options)
                    this.registerPlugins(options)
                    this.grid.invalidate()
                    this.registerAdditionalSlickEvents()
                    ComponentJS(this).touch("data:columns")
                }
            });

            ComponentJS(this).observe({
                name: "data:treeColumnWidth", spool: "materialized",
                func: (ev, treeColumnWidth) => {
                    let columns = this.grid.getColumns();
                    let treeColumn = _.find(columns, {id: "_tree_toggler"});
                    if (treeColumn) {
                        treeColumn.minWidth = treeColumnWidth;
                        treeColumn.width = treeColumnWidth;
                        this.grid.setColumns(columns);
                    }
                }
            });
        },

        registerGridBindings () {

            //handle click and doubleClick on cell
            this.grid.onClick.subscribe((e, args) => {
                let cell = this.grid.getCellFromEvent(e);
                //if grid data was newly set, it could be that cell = null, but in args we have the clicked cell data
                if (!cell)
                    cell = {cell: args.cell, row: args.row};
                let cellId = this.grid.getColumns()[cell.cell].id;
                let obj = {
                    cell: cell,
                    cellId: cellId
                };
                ComponentJS(this).value("event:cellClicked", obj, true);
            });

            this.grid.onScroll.subscribe(() => {
                this.registerAdditionalSlickEvents();
            });

            /*
             * when a column changes position or size .. hand the columns to the outer controller .. he might want to
             * save the columns in his model for persistence
             */
            this.grid.onColumnsReordered.subscribe(() => {
                this.registerAdditionalSlickEvents();
            });

            this.grid.onColumnsResized.subscribe(() => {
                this.registerAdditionalSlickEvents();
            });

            this.grid.onCellChange.subscribe(() => {
                let cell = this.grid.getActiveCell();
                if (cell) {
                    let id = this.grid.getColumns()[cell.cell].id;
                    ComponentJS(this).value("event:dataChanged", {cell: cell, cellId: id})
                }
            });

            this.grid.onAddNewRow.subscribe((e, args) => {
                ComponentJS(this).value("event:newRowAdded", args)
            });

            this.grid.onSort.subscribe((e, args) => {
                ComponentJS(this).value("event:sortColumns", args, true);
                this.grid.resetActiveCell();
                e.stopPropagation();
            });

            this.grid.onSelectedRowsChanged.subscribe((e, args) => {
                if (!this.disableSlickevents) {
                    let selectedDataItems = [], i;
                    for (i = 0; i < args.rows.length; i++) {
                        let item = args.grid.getData().getItem(args.rows[i])
                        if (item)
                            selectedDataItems.push(item)
                    }
                    ComponentJS(this).value("event:selectedRowsChanged", selectedDataItems)
                }
                this.registerAdditionalSlickEvents()
            });

            this.grid.onActiveCellChanged.subscribe((e, args) => {
                let obj = {};
                if (args && args.cell >= 0 && args.row >= 0) {
                    obj = {
                        columnId: this.grid.getColumns()[args.cell].id,
                        row: args.row,
                        cell: args.cell
                    };
                }
                ComponentJS(this).value("event:activeCellChanged", obj, true);
            });

            this.grid.onBeforeEditCell.subscribe((e, args) => {
                return this.onBeforeEditCellCallback(args);
            });

            this.grid.onMouseEnter.subscribe((event) => {
                let cell = this.grid.getCellFromEvent(event);
                let column = this.grid.getColumns()[cell.cell];
                let target = $(event.target);
                ComponentJS(this).value("event:onMouseEnter", {cell: cell, target: target, columnId: column.id});
            });

            this.grid.onMouseLeave.subscribe(() => {
                ComponentJS(this).value("event:onMouseLeave", true);
            });

            this.grid.onDragInit.subscribe(e => {
                // prevent the grid from cancelling drag'n'drop by default
                e.stopImmediatePropagation();
            });

            this.grid.onDragStart.subscribe((e, dd) => {
                let cell = this.grid.getCellFromEvent(e);
                if (!cell) return;
                dd.row = cell.row;
                if (Slick.GlobalEditorLock.isActive()) return;

                e.stopImmediatePropagation();

                ComponentJS(this).value("event:dragStarted", dd);
                // KGR-START:
                // notwendig damit der D&D nicht ausgeloest bei einer Tabelle die kein Formatter hinterlegt hat
                if (!dd.active) return;
                // damit das mousewheel event nicht vom D&D-Element abgefangen wird (geht im IE9 nicht)
                dd.helper.css({pointerEvents: 'none'});
                // KGR-END:
                return dd.helper;
            });

            this.grid.onDrag.subscribe((e, dd) => {
                if (!dd.active) {
                    return;
                }
                // KGR-START:
                // wenn nicht mehrfach aufgerufen wird der cursor im IE9 nicht auf 'move' geaendert
                $('body').css({cursor: 'move'});
                //pageX + 1 (vorher: pageX - 10) damit der Cursor nicht auf dem D&D-Element liegt, dass das mousewheel event nicht abgefangen wird
                // KGR-END:
                dd.helper.css({top: e.pageY - 5, left: e.pageX + 1});
            });

            this.grid.onDragEnd.subscribe((e, dd) => {
                if (!dd.active) {
                    return;
                }
                // KGR-START:
                // setzt den cursor wieder zurueck
                $('body').css({cursor: 'default'});
                // KGR-END:
                dd.helper.remove();
            });
        },

        prepareTableRendering () {
            let columns = ComponentJS(this).value("data:columns")
            let options = ComponentJS(this).value("data:options")

            columns = this.functionalColumns().concat(columns)

            // Pass the DataView as a data provider to SlickGrid.
            let data = ComponentJS(this).value("data:dataView") || ComponentJS(this).value("data:data");
            this.grid = new Slick.Grid(this.ui, data, columns, options);

            this.grid.registerPlugin(new Slick.AutoTooltips())
            this.registerPlugins(options)
        },

        functionalColumns () {
            let options = ComponentJS(this).value("data:options")
            let functionalColumns = []
            let checkboxSelector, treeToggler
            if (options.activateSelectPlugIn) {
                if (options.multiSelect) {
                    checkboxSelector = ComponentJS(this).value("data:multiSelectPlugin")
                } else {
                    checkboxSelector = ComponentJS(this).value("data:singleSelectPlugin")
                }
                if (checkboxSelector)
                    functionalColumns.push(checkboxSelector.getColumnDefinition())
            }

            if (options.activateTreeTableFunctionality) {
                treeToggler = ComponentJS(this).value("data:treePlugin")
                functionalColumns.push(treeToggler.getColumnDefinition())
            }
            return functionalColumns
        },

        registerPlugins (options) {

            // R O W   S E L E C T I O N
            if (options.activateRowSelectionModel) {
                this.grid.setSelectionModel(new Slick.RowSelectionModel({selectActiveRow: options.activateSelectPlugIn ? options.selectActiveRow : true}))
            } else {
                if (this.grid.getSelectionModel())
                    this.resetRowSelection()
                this.grid.setSelectionModel()
            }

            // S E L E C T I O N   O V E R   S E P A R A T E   C O L U M N
            let checkboxSelector, pluginKey
            if (options.multiSelect) {
                checkboxSelector = ComponentJS(this).value("data:multiSelectPlugin")
                pluginKey = "multiSelectPlugin"
            } else {
                checkboxSelector = ComponentJS(this).value("data:singleSelectPlugin")
                pluginKey = "singleSelectPlugin"
            }
            this.updatePlugin(checkboxSelector, pluginKey, options.activateSelectPlugIn)


            // T R E E - T A B L E
            this.updatePlugin(ComponentJS(this).value("data:treePlugin"), "treePlugin", options.activateTreeTableFunctionality)


            // G R O U P I N G   A C T I V A T E D
            this.updatePlugin(ComponentJS(this).value("data:groupItemMetadataProvider"), "groupPlugin", options.activateGrouping)


            // R O W   M O V E   A C T I V A T E D
            let rowMoveManager = ComponentJS(this).value("data:rowMovePlugin")
            if (rowMoveManager) {
                if (options.activateRowMoveManager) {
                    if (!this.registeredPlugins["rowMovePlugin"]) {
                        this.grid.registerPlugin(rowMoveManager);
                        this.registerRowMoveManagerEvents(rowMoveManager)
                        this.registeredPlugins["rowMovePlugin"] = true
                    }
                } else {
                    this.unregisterRowMoveManagerEvents(rowMoveManager)
                    this.grid.unregisterPlugin(rowMoveManager)
                    delete this.registeredPlugins["rowMovePlugin"]
                }
            }
        },

        updatePlugin (plugin, pluginKey, option) {
            if (plugin) {
                if (option) {
                    if (!this.registeredPlugins[pluginKey]) {
                        this.grid.registerPlugin(plugin)
                        this.registeredPlugins[pluginKey] = true
                    } else {
                        plugin.init(this.grid)
                    }
                } else {
                    this.grid.unregisterPlugin(plugin)
                    delete this.registeredPlugins[pluginKey]
                }
            }
        },

        registerRowMoveManagerEvents (rowMoveManager) {

            this.onBeforeMoveRows = (e, data) => {
                for (let i = 0; i < data.rows.length; i++) {
                    // no point in moving before or after itthis
                    if (data.rows[i] == data.insertBefore || data.rows[i] == data.insertBefore - 1) {
                        e.stopPropagation();
                        return false;
                    }
                }
                return this.onBeforeMoveRowsCallback(e, data);
            }

            rowMoveManager.onBeforeMoveRows.subscribe(this.onBeforeMoveRows.bind(this))

            this.onMoveRows = (e, args) => {
                let obj = {
                    rows: args.rows,
                    insertBefore: args.insertBefore
                };
                ComponentJS(this).value("event:rowsMoved", obj, true)
            }

            rowMoveManager.onMoveRows.subscribe(this.onMoveRows.bind(this))
        },

        unregisterRowMoveManagerEvents (rowMoveManager) {
            rowMoveManager.onBeforeMoveRows.unsubscribe(this.onBeforeMoveRows)
            rowMoveManager.onMoveRows.unsubscribe(this.onMoveRows)
        },

        resetRowSelection () {
            this.disableSlickevents = true;
            this.grid.setSelectedRows([]);
            this.disableSlickevents = false;
        },

        registerAdditionalSlickEvents () {
            if (this.grid) {
                for (let i = 0; i < this.grid.getDataLength(); ++i) {
                    _.forEach(ComponentJS(this).value("data:columns"), column => {
                        let colIndex = this.grid.getColumnIndex(column.id);
                        if (column.tableDroppable) {
                            $(this.grid.getCellNode(i, colIndex))
                                .unbind("dropstart dropend drop")
                                .bind("dropstart", this.handleOver.bind(this))
                                .bind("dropend", this.handleOut.bind(this))
                                .bind("drop", this.handleDropEvent.bind(this));
                            // needed that it is just highlighted when the mouse hovers, NOT when the drag element hovers
                            $.drop({mode: true});
                        }
                    });
                }
            }
        },

        handleOver (ev, drop) {
            ev.target = ev.currentTarget;
            let cell = this.grid.getCellFromEvent(ev);
            ComponentJS(this).value("event:onDropstart", {
                columnId: this.grid.getColumns()[cell.cell].id,
                cell: cell,
                ev: ev,
                drop: drop
            });
        },

        handleOut (ev) {
            ComponentJS(this).value("event:onDropend", ev);
        },

        handleDropEvent (ev, drop) {
            ev.target = ev.currentTarget;
            let cell = this.grid.getCellFromEvent(ev);
            ComponentJS(this).value("event:onDrop", {
                columnId: this.grid.getColumns()[cell.cell].id,
                cell: cell,
                drop: drop
            });
            this.handleOut(ev)
        },

        // a click on this component is interrupting event propagation to determine an outside grid click
        interruptClickHandler (e) {
            if (e.currentTarget === this.slickViewport[0]) {
                this.interruptClickOutside = true;
            }
        },

        // a click listener outside this component is closing any open editor on this grid and resets the active cell
        clickOutsideHandler (/*e*/) {
            if (!this.interruptClickOutside && this.grid) {
                this.grid.getEditorLock().commitCurrentEdit();
                this.grid.resetActiveCell();
            }
            this.interruptClickOutside = false;
        }
    }
});
