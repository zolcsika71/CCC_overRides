const mod = {};
module.exports = mod;
mod.analyzeRoom = function (room, needMemoryResync) {
    if (Game.time % global.PROCESS_ORDERS_INTERVAL === 0 || room.name === 'sim') {
        room.updateResourceOrders();
        let orderingRoom = global.orderingRoom();
        if ((orderingRoom.length === 1 && room.name !== orderingRoom[0].name) || orderingRoom.length === 0) {
            //room.garbageCollectStorageOrders();
            //room.garbageCollectTerminalOrders();
            room.updateRoomOrders();
            room.terminalOrderToSell();
            room.terminalBroker();
        }
    }
};
mod.extend = function () {

    Room.prototype.updateResourceOrders = function () {
        let data = this.memory.resources;
        if (!this.my || !data) return;

        // go through reallacation orders and reset completed orders
        for (var structureType in data) {
            for (var i = 0; i < data[structureType].length; i++) {
                let structure = data[structureType][i];
                // don't reset busy labs
                if (structureType == STRUCTURE_LAB && structure.reactionState != LAB_IDLE) continue;
                if (!structure.orders) continue;
                for (var j = 0; j < structure.orders.length; j++) {
                    let order = structure.orders[j];
                    if (order.orderRemaining <= 0) {
                        let baseAmount = 0;
                        let rcl = this.controller.level;
                        if (structureType == STRUCTURE_STORAGE) baseAmount = order.type == RESOURCE_ENERGY ? MIN_STORAGE_ENERGY[rcl] : MAX_STORAGE_MINERAL;
                        else if (structureType == STRUCTURE_TERMINAL) baseAmount = order.type == RESOURCE_ENERGY ? TERMINAL_ENERGY : 0;
                        baseAmount += order.storeAmount;
                        let amount = 0;
                        let cont = Game.getObjectById(structure.id);
                        if (cont && structureType == STRUCTURE_LAB) {
                            switch (structureType) {
                                case STRUCTURE_LAB:
                                    // get lab amount
                                    if (order.type == cont.mineralType) {
                                        amount = cont.mineralAmount;
                                    } else if (order.type == RESOURCE_ENERGY) {
                                        amount = cont.energy;
                                    }
                                    break;
                                case STRUCTURE_POWER_SPAWN:
                                    // get power spawn amount
                                    if (order.type == RESOURCE_POWER) {
                                        amount = cont.power;
                                    } else if (order.type == RESOURCE_ENERGY) {
                                        amount = cont.energy;
                                    }
                                    break;
                                case STRUCTURE_NUKER:
                                    // get nuker amount
                                    if (order.type == RESOURCE_GHODIUM) {
                                        amount = cont.ghodium;
                                    } else if (order.type == RESOURCE_ENERGY) {
                                        amount = cont.energy;
                                    }
                                    break;
                                default:
                                    // get stored amount
                                    amount = cont.store[order.type] || 0;
                                    break;
                            }
                        }
                        if (amount < baseAmount) {
                            order.orderAmount = 0;
                            order.orderRemaining = 0;
                        }
                    }
                }
            }
        }
    };

    Room.prototype.updateRoomOrders = function () {
        if (!this.memory.resources || !this.memory.resources.orders) return;
        let rooms = _.filter(Game.rooms, room => {
            return room.my && room.storage && room.terminal && room.name !== this.name;
        });
        let orders = this.memory.resources.orders;
        for (let i = 0; i < orders.length; i++) {
            let order = orders[i];
            let amountRemaining = order.amount;
            for (let j = 0; j < order.offers.length; j++) {
                let offer = order.offers[j];
                if (Memory.rooms[offer.room] && Memory.rooms[offer.room].resources && Memory.rooms[offer.room].resources.offers) {
                    let remoteOffers = Memory.rooms[offer.room].resources.offers;
                    let idx = remoteOffers.indexOf(o => {
                        return o.room === this.name && o.id === order.id && o.type === order.type;
                    });
                    if (idx !== -1) remoteOffers.splice(idx, 1);
                }
            }
            order.offers = [];
            if (amountRemaining <= 0) {
                //orders.splice(i, 1);
                //i--;
                delete orders[i];
                orders.splice(i--, 1);
            } else {
                rooms.sort((a, b) => {
                    return Game.map.getRoomLinearDistance(this.name, a.name, true) - Game.map.getRoomLinearDistance(this.name, b.name, true);
                });
                for (let j = 0; j < rooms.length; j++) {
                    let room = rooms[j];
                    if (room.memory.resources === undefined) {
                        room.memory.resources = {
                            lab: [],
                            container: [],
                            terminal: [],
                            storage: [],
                            powerSpawn: []
                        };
                    }
                    if (!room.memory.resources.offers)
                        room.memory.resources.offers = [];
                    let remoteOffers = room.memory.resources.offers;
                    let available = room.resourcesAll[order.type] || 0;
                    if (available < global.MIN_OFFER_AMOUNT)
                        continue;

                    // for COMPOUNDS_TO_ALLOCATE
                    if (!_.isUndefined(global.COMPOUNDS_TO_ALLOCATE[order.type]) && global.COMPOUNDS_TO_ALLOCATE[order.type].allocate) {
                        let reservedAmount = global.COMPOUNDS_TO_ALLOCATE[order.type].amount + global.COMPOUNDS_TO_ALLOCATE[order.type].roomThreshold;
                        if (available < reservedAmount + global.MIN_OFFER_AMOUNT)
                            continue;
                        else
                            available = available - reservedAmount;
                    }

                    if (amountRemaining < global.MIN_OFFER_AMOUNT && amountRemaining > 0)
                        amountRemaining = global.MIN_OFFER_AMOUNT;

                    available = Math.min(available, amountRemaining);

                    let existingOffer = order.offers.find(o => {
                        return o.room === room.name;
                    });
                    let existingRemoteOffer = remoteOffers.find(o => {
                        return o.room === this.name && o.id === order.id && o.type === order.type;
                    });
                    if (existingOffer) {
                        if (global.DEBUG && global.TRACE)
                            global.trace("Room", { roomName: this.name, remoteRoom: room.name, actionName: 'updateRoomOrders', subAction: 'update', orderId: order.id, resourceType: order.type, amount: available });
                        amountRemaining -= (available - existingOffer.amount);
                        existingOffer.amount = available;
                    } else {
                        if (global.DEBUG && global.TRACE)
                            global.trace("Room", { roomName: this.name, remoteRoom: room.name, actionName: 'updateRoomOrders', subAction: 'new', orderId: order.id, resourceType: order.type, amount: available });
                        if (global.DEBUG)
                            global.logSystem(this.name, `Room offer from ${room.name} with id ${order.id} placed for ${available} ${order.type}.`);
                        amountRemaining -= available;
                        order.offers.push({
                            room: room.name,
                            amount: available
                        });
                    }
                    if (existingRemoteOffer) {
                        existingRemoteOffer.amount = available;
                    } else {
                        remoteOffers.push({
                            room: this.name,
                            id: order.id,
                            type: order.type,
                            amount: available
                        });
                    }
                    if (amountRemaining <= 0)
                        break;
                }
            }
        }
    };

    Room.prototype.fillARoomOrder = function () {
        if (!(this.terminal && this.memory && this.memory.resources && this.memory.resources.offers)) return false;
        let offers = this.memory.resources.offers,
            ret = false;
        for (let i = 0; i < offers.length; i++) {
            let offer = offers[i];
            let targetRoom = Game.rooms[offer.room];
            if (!(targetRoom && targetRoom.memory && targetRoom.memory.resources && targetRoom.memory.resources.orders)) continue;
            let order = targetRoom.memory.resources.orders.find((o)=> {
                return o.id == offer.id && o.type == offer.type;
            });
            if (!order) continue;
            let targetOfferIdx = order.offers.findIndex((o)=> {
                return o.room == this.name;
            });
            if (targetOfferIdx == -1) {
                logSystem(this.name, "Orphaned offer found and deleted");
                offers.splice(i--, 1);
                continue;
            }

            let store = this.terminal.store[offer.type] || 0;
            let onOrder = 0;
            let terminalOrder = null;
            if (this.memory.resources.terminal[0]) terminalOrder = this.memory.resources.terminal[0].orders.find((o)=> {
                return o.type == offer.type;
            });
            if (terminalOrder) onOrder = terminalOrder.orderRemaining;
            let amount = Math.max(offer.amount, global.MIN_OFFER_AMOUNT);
            if (amount > (store + onOrder)) {
                let amt = amount - (store + onOrder);
                if (global.DEBUG && global.TRACE) trace("Room", { actionName: 'fillARoomOrder', subAction: 'terminalOrder', roomName: this.name, targetRoomName: targetRoom.name, resourceType: offer.type, amount: amt });
                this.placeOrder(this.terminal.id, offer.type, amt);
            }
            if (!targetRoom.terminal) continue;
            let space = targetRoom.terminal.storeCapacity - targetRoom.terminal.sum;
            amount = Math.min(amount, space, store);

            let cost = Game.market.calcTransactionCost(amount, this.name, targetRoom.name);
            if (offer.type == RESOURCE_ENERGY) {
                amount -= cost;
                cost += amount;
            }
            if (cost > (this.terminal.store.energy || 0)) continue;
            if (amount < global.MIN_OFFER_AMOUNT) continue;

            ret = this.terminal.send(offer.type, amount, targetRoom.name, order.id);
            if (ret == OK) {
                if (global.DEBUG && global.TRACE) trace("Room", { actionName: 'fillARoomOrder', roomName: this.name, targetRoomName: targetRoom.name, resourceType: offer.type, amount: amount });
                if (global.DEBUG) logSystem(this.name, `Room order filled to ${targetRoom.name} for ${amount} ${offer.type}.`);
                offer.amount -= amount;
                if (offer.amount > 0) {
                    order.offers[targetOfferIdx].amount = offer.amount;
                } else {
                    delete order.offers[targetOfferIdx];
                    order.offers.splice(targetOfferIdx, 1);
                    delete offers[i];
                    offers.splice(i--, 1);
                }
                order.amount -= amount;
                return true;
            }
        }

        return ret;
    };

    Room.prototype.prepareResourceOrder = function (containerId, resourceType, amount) {
        let container = Game.getObjectById(containerId);
        if (!this.my || !container || !container.room.name == this.name ||
            !(container.structureType == STRUCTURE_LAB ||
                container.structureType == STRUCTURE_POWER_SPAWN ||
                container.structureType == STRUCTURE_NUKER ||
                container.structureType == STRUCTURE_CONTAINER ||
                container.structureType == STRUCTURE_STORAGE ||
                container.structureType == STRUCTURE_TERMINAL)) {
            return ERR_INVALID_TARGET;
        }
        if (!RESOURCES_ALL.includes(resourceType)) {
            return ERR_INVALID_ARGS;
        }
        if (this.memory.resources === undefined) {
            this.memory.resources = {
                lab: [],
                powerSpawn: [],
                nuker: [],
                container: [],
                terminal: [],
                storage: []
            };
        }
        if (this.memory.resources.powerSpawn === undefined) this.memory.resources.powerSpawn = [];
        if (this.memory.resources.nuker === undefined) this.memory.resources.nuker = [];
        if (!this.memory.resources[container.structureType].find((s) => s.id == containerId)) {
            this.memory.resources[container.structureType].push(container.structureType == STRUCTURE_LAB ? {
                id: containerId,
                orders: [],
                reactionState: LAB_IDLE
            } : {
                id: containerId,
                orders: []
            });
        }
        if (container.structureType == STRUCTURE_LAB && resourceType != RESOURCE_ENERGY && amount > 0) {
            // clear other resource types since labs only hold one at a time
            let orders = this.memory.resources[STRUCTURE_LAB].find((s)=>s.id == containerId).orders;
            for (var i = 0; i < orders.length; i++) {
                if (orders[i].type != resourceType && orders[i].type != RESOURCE_ENERGY) {
                    orders[i].orderAmount = 0;
                    orders[i].orderRemaining = 0;
                    orders[i].storeAmount = 0;
                }
            }
        }
        return OK;
    };

    Room.prototype.cancelOrder = function (containerId, resourceType = null) {
        let container = Game.getObjectById(containerId);
        if (this.prepareResourceOrder(containerId, RESOURCE_ENERGY, 0) != OK) return ret;

        let containerData = this.memory.resources[container.structureType].find((s) => s.id == containerId);
        if (containerData) {
            if (resourceType) {
                let existingOrder = containerData.orders.find((r) => r.type == resourceType);
                if (existingOrder) {
                    // delete structure order
                    if (global.DEBUG && global.TRACE) trace("Room", { roomName: this.name, actionName: 'cancelOrder', orderId: orderId, resourceType: resourceType })
                    containerData.orders.splice(containerData.orders.indexOf(existingOrder), 1);
                }
            } else {
                // delete all of structure's orders
                if (global.DEBUG && global.TRACE) trace("Room", { roomName: this.name, actionName: 'cancelOrder', orderId: orderId, resourceType: 'all' })
                containerData.orders = [];
            }
        }
        return OK;
    };

    Room.prototype.registerBoostLab = function (labId) {
        let lab = Game.getObjectById(labId);
        if (lab) {
            if (_.isUndefined(this.memory.resources)) {
                this.memory.resources = {
                    lab: [],
                    powerSpawn: [],
                    container: [],
                    terminal: [],
                    storage: []
                }
            }
            let dataIndex = this.memory.resources.lab.findIndex(x=>x.id == labId);
            if (dataIndex > -1) {
                delete this.memory.resources.lab[dataIndex].reactionType;
                this.memory.resources.lab[dataIndex].reactionState = 'Storage';
            } else {
                let obj = {id: labId, orders: [], reactionState: 'Storage'};
                this.memory.resources.lab.push(obj);
            }
        }
    };

    Room.prototype.unRegisterBoostLab = function (labId) {
        let lab = Game.getObjectById(labId),
            data = this.memory.resources;

        if (lab && data) {
            let dataIndex = this.memory.resources.lab.findIndex(x => x.id === labId);
            if (dataIndex > -1) {
                if (data.reactions && data.reactions.orders.length > 0)
                    this.memory.resources.lab[dataIndex].reactionType = this.memory.resources.reactions.orders[0].type;
                this.memory.resources.lab[dataIndex].reactionState = 'idle';
                this.memory.resources.lab[dataIndex].orders = _.filter(this.memory.resources.lab[dataIndex].orders, 'type', 'energy');
            }
        }
    };

    Room.prototype.placeOrder = function (containerId, resourceType, amount) {
        let container = Game.getObjectById(containerId);
        let ret = this.prepareResourceOrder(containerId, resourceType, amount);
        if (ret != OK) {
            return ret;
        }

        let containerData = this.memory.resources[container.structureType].find((s) => s.id == containerId);
        if (containerData) {
            let existingOrder = containerData.orders.find((r) => r.type == resourceType);
            if (existingOrder) {
                existingOrder.orderAmount += amount;
                existingOrder.orderRemaining += amount;
            } else {
                let containerStore = 0;
                if (container.structureType === STRUCTURE_LAB) {
                    containerStore = (container.mineralType == resourceType) ? container.mineralAmount : 0;
                } else {
                    containerStore = (container.store[resourceType] || 0);
                }
                containerData.orders.push({
                    type: resourceType,
                    orderAmount: amount,
                    orderRemaining: amount - containerStore,
                    storeAmount: 0
                });
                if (container.structureType === STRUCTURE_LAB && containerData.reactionState != 'Storage') {
                    containerData.reactionType = resourceType;
                }
            }
        }
        return OK;
    };

    Room.prototype.setStore = function (containerId, resourceType, amount) {
        let container = Game.getObjectById(containerId);
        let ret = this.prepareResourceOrder(containerId, resourceType, amount);
        if (ret != OK) {
            return ret;
        }

        let containerData = this.memory.resources[container.structureType].find((s) => s.id == containerId);
        if (containerData) {
            let existingOrder = containerData.orders.find((r) => r.type == resourceType);
            if (existingOrder) {
                existingOrder.storeAmount = amount;
            } else {
                containerData.orders.push({
                    type: resourceType,
                    orderAmount: 0,
                    orderRemaining: 0,
                    storeAmount: amount
                });
            }
        }
        return OK;
    };

    Room.prototype.cancelRoomOrder = function (orderId = null, resourceType = null) {
        if (this.memory.resources === undefined) {
            this.memory.resources = {
                lab: [],
                container: [],
                terminal: [],
                storage: []
            };
        }
        if (this.memory.resources.powerSpawn === undefined) this.memory.resources.powerSpawn = [];
        if (this.memory.resources.orders === undefined) {
            this.memory.resources.orders = [];
        }
        let orders = this.memory.resources.orders;
        if (orderId && resourceType) {
            let existingOrder = orders.find((o)=> {
                return o.id == orderId && o.type == resourceType;
            });
            if (existingOrder) {
                // delete existing order
                if (global.DEBUG && global.TRACE) trace("Room", { roomName: this.name, actionName: 'cancelRoomOrder', orderId: orderId, resourceType: resourceType })
                orders.splice(orders.indexOf(existingOrder), 1);
            }
        } else if (orderId) {
            // delete all orders matching orderId
            if (global.DEBUG && global.TRACE) trace("Room", { roomName: this.name, actionName: 'cancelRoomOrder', orderId: orderId, resourceType: 'all' })
            for (let i = 0; i < orders.length; i++) {
                let order = orders[i];
                if (order.id === orderId) {
                    orders.splice(i--, 1);
                }
            }
        } else {
            // delete all orders associated with this room
            this.memory.resources.orders = [];
        }

        return OK;
    };

    Room.prototype.placeRoomOrder = function (orderId, resourceType, amount) {
        if (amount <= 0) return OK;
        if (this.memory.resources === undefined) {
            this.memory.resources = {
                lab: [],
                container: [],
                terminal: [],
                storage: []
            };
        }
        if (this.memory.resources.powerSpawn === undefined) this.memory.resources.powerSpawn = [];
        if (this.memory.resources.orders === undefined) {
            this.memory.resources.orders = [];
        }
        let orders = this.memory.resources.orders;
        let existingOrder = orders.find((o)=> {
            return o.id == orderId && o.type == resourceType;
        });
        if (existingOrder) {
            // update existing order
            if (global.DEBUG && global.TRACE) trace("Room", { roomName: this.name, actionName: 'placeRoomOrder', subAction: 'update', orderId: orderId, resourceType: resourceType, amount: amount })
            existingOrder.amount = amount;
        } else {
            // create new order
            if (global.DEBUG && global.TRACE) trace("Room", { roomName: this.name, actionName: 'placeRoomOrder', subAction: 'new', orderId: orderId, resourceType: resourceType, amount: amount })
            if (global.DEBUG) logSystem(this.name, `New room order with id ${orderId} placed for ${amount} ${resourceType}.`);
            orders.push({
                id: orderId,
                type: resourceType,
                amount: amount,
                offers: []
            });
        }
        return OK;
    };

    Room.prototype.terminalBroker = function () {

        if (!this.my || !this.terminal || !this.storage) return;
        if (this.terminal.cooldown && this.terminal.cooldown > 0) return;

        if (!Memory.numberOfTransactions)
            Memory.numberOfTransactions = {};

        let numberOfTransactions = Memory.numberOfTransactions;

        if (numberOfTransactions.time !== Game.time) {
            numberOfTransactions.count = 1;
            numberOfTransactions.time = Game.time;
        }

        let that = this;
        let order;
        let transacting = false;
        let terminalFull = (this.terminal.sum / this.terminal.storeCapacity) > 0.9;
        let storageFull = (this.storage.sum / this.storage.storeCapacity) > 0.9;

        if (this.controller.level === 8 && Util.chargeScale(this.storage.store.energy - ENERGY_BALANCE_TRANSFER_AMOUNT, MIN_STORAGE_ENERGY[this.controller.level], MAX_STORAGE_ENERGY[this.controller.level]) > 1
            && (this.terminal.store[this.mineralType] || 0) < 150000
            && this.terminal.store.energy > (ENERGY_BALANCE_TRANSFER_AMOUNT * 1.1)) {
            let requiresEnergy = room => (
                room.my && room.storage && room.terminal &&
                room.terminal.sum < room.terminal.storeCapacity - ENERGY_BALANCE_TRANSFER_AMOUNT &&
                room.storage.sum < room.storage.storeCapacity * TARGET_STORAGE_SUM_RATIO &&
                !room._isReceivingEnergy &&
                room.storage.store[RESOURCE_ENERGY] < MAX_STORAGE_ENERGY[room.controller.level]
            );
            let targetRoom = _.min(_.filter(Game.rooms, requiresEnergy), 'storage.store.energy');
            if (targetRoom instanceof Room && Game.market.calcTransactionCost(ENERGY_BALANCE_TRANSFER_AMOUNT, this.name, targetRoom.name) < (this.terminal.store.energy - ENERGY_BALANCE_TRANSFER_AMOUNT)) {
                targetRoom._isReceivingEnergy = true;
                let response = this.terminal.send('energy', ENERGY_BALANCE_TRANSFER_AMOUNT, targetRoom.name, 'have fun');
                if (global.DEBUG) logSystem(that.name, `Transferring ${Util.formatNumber(ENERGY_BALANCE_TRANSFER_AMOUNT)} energy to ${targetRoom.name}: ${translateErrorCode(response)}`);
                transacting = response === OK;
            }
        }

        //global.logSystem(this.name, `transacting: ${transacting} no: ${numberOfTransactions.count}`);

        if (this.controller.level === 8 || global.MARKET_SELL_NOT_RCL8_ROOMS || terminalFull || storageFull) {

            if (numberOfTransactions.count <= 10 && !transacting) {

                let data = this.memory.resources,
                    returnValue,
                    cloakedMinerals = function (mineral) {


                        // TODO count unnecessary amount

                        if (_.isUndefined(data))
                            return false;

                        let offerMineral = _.some(data.offers, offer => {
                            return offer.type === mineral && offer.amount > 0;
                        }),
                            orderMineral = _.some(data.orders, order => {
                                return order.type === mineral && order.amount > 0;
                            }),
                            reactionMineral = function (mineral) {

                                let component_a,
                                    component_b;

                                if (data.reactions.orders.length > 0) {
                                    component_a = LAB_REACTIONS[data.reactions.orders[0].type][0];
                                    component_b = LAB_REACTIONS[data.reactions.orders[0].type][1];
                                }

                                return mineral === component_a || mineral === component_b;


                            };

                        return offerMineral || orderMineral || reactionMineral(mineral);
                    };

                for (const mineral in this.terminal.store) {

                    if (mineral === RESOURCE_POWER || cloakedMinerals(mineral))
                        continue;

                    if (mineral.length > 1 && global.SELL_COMPOUND[mineral]) {

                        if (global.SELL_COMPOUND[mineral].sell) {
                            global.logSystem(that.name, `making sell order for ${that.terminal.store[mineral]} ${mineral}`)
                            // global.sumCompoundType(resources.terminal[0].orders, 'orderRemaining')[mineral] === 0 => terminal order completed

                        } else if (that.nuked) {
                            global.logSystem(that.name, `making URGENT sell order for ${that.terminal.store[mineral]} ${mineral}`)
                        } else
                            continue;
                    } else if (
                        (mineral === that.memory.mineralType && this.terminal.store[mineral] >= global.MIN_MINERAL_SELL_AMOUNT)
                        || (mineral === RESOURCE_ENERGY && this.storage.store[RESOURCE_ENERGY] >= global.MAX_STORAGE_ENERGY[8] * 1.2 && this.terminal.store[RESOURCE_ENERGY] >= global.TERMINAL_ENERGY * 0.8)
                        || (mineral !== that.memory.mineralType && mineral !== RESOURCE_ENERGY && mineral !== 'G' && this.terminal.store[mineral] >= global.MIN_MINERAL_SELL_AMOUNT)
                        //|| (this.nuked && global.SELL_COMPOUND[mineral] && this.terminal.store[mineral] >= global.MIN_MINERAL_SELL_AMOUNT)
                    ) {

                        let orders = Game.market.getAllOrders(o => {

                            if (!o.roomName || o.type !== 'buy')
                                return false;

                            if (o.resourceType !== mineral)
                                return false;

                            if (o.resourceType !== RESOURCE_ENERGY && o.amount < global.MIN_MINERAL_SELL_AMOUNT)
                                return false;

                            if (o.resourceType === RESOURCE_ENERGY && o.amount < global.MIN_ENERGY_SELL_AMOUNT)
                                return false;

                            o.range = Game.map.getRoomLinearDistance(o.roomName, that.name, true);

                            o.transactionAmount = Math.min(o.amount, that.terminal.store[mineral]);
                            o.transactionCost = Game.market.calcTransactionCost(
                                o.transactionAmount,
                                that.name,
                                o.roomName);

                            if (o.transactionCost > that.terminal.store.energy && o.transactionAmount > global.MIN_MINERAL_SELL_AMOUNT && mineral !== RESOURCE_ENERGY) {
                                // cant afford. try min amount
                                o.transactionAmount = global.MIN_MINERAL_SELL_AMOUNT;

                                o.transactionCost = Game.market.calcTransactionCost(
                                    o.transactionAmount,
                                    that.name,
                                    o.roomName);
                            }
                            if (o.transactionCost > (that.terminal.store.energy - o.transactionAmount) && o.transactionAmount > global.MIN_ENERGY_SELL_AMOUNT && mineral === RESOURCE_ENERGY) {
                                // cant afford. try min amount
                                o.transactionAmount = global.MIN_ENERGY_SELL_AMOUNT;

                                o.transactionCost = Game.market.calcTransactionCost(
                                    o.transactionAmount,
                                    that.name,
                                    o.roomName);
                            }

                            o.credits = o.transactionAmount * o.price;
                            o.ratio = (o.credits - (o.transactionCost * global.ENERGY_VALUE_CREDITS)) / o.transactionAmount; // best offer assuming 1e == ENERGY_VALUE_CREDITS credits



                            if (mineral !== RESOURCE_ENERGY)
                                returnValue = o.transactionCost <= that.terminal.store.energy;
                            else
                                returnValue = o.transactionCost <= that.terminal.store.energy + o.transactionAmount;

                            return returnValue
                        });

                        if (orders.length > 0) {
                            global.logSystem(that.name, `no.: ${numberOfTransactions.count} ${that.name} selling: ${mineral} terminalFull: ${terminalFull} storageFull: ${storageFull}`);
                            order = _.max(orders, 'ratio');
                            if (global.DEBUG) {
                                //for (let o of orders)
                                //    console.log(`id: ${o.id} ratio: ${global.roundUp(o.ratio, 4)} price: ${o.price} credit: ${global.roundUp(o.credits / o.transactionAmount, 4)} range: ${o.range}`);

                                global.logSystem(that.name, 'selected order: ');
                                global.logSystem(that.name, `id: ${order.id} ratio: ${global.roundUp(order.ratio, 4)} price: ${order.price} credit: ${global.roundUp(order.credits / order.transactionAmount, 4)} range: ${order.range}`);
                            }
                            let result = Game.market.deal(order.id, order.transactionAmount, that.name);
                            if (global.DEBUG || SELL_NOTIFICATION) logSystem(that.name, `Selling ${order.transactionAmount} ${mineral} for ${global.roundUp(order.credits)} (${order.price} ¢/${mineral}, ${order.transactionCost} e): ${translateErrorCode(result)}`);
                            if (SELL_NOTIFICATION) Game.notify(`<h2>Room ${that.name} executed an order!</h2><br/>Result: ${translateErrorCode(result)}<br/>Details:<br/>${JSON.stringify(order).replace(',', ',<br/>')}`);
                            if (result === OK && Memory.numberOfTransactions.time === Game.time)
                                numberOfTransactions.count++;
                            transacting = result === OK;
                            break;
                        } else
                            global.logSystem(this.name, `No order found for ${mineral}`);
                    } else
                        global.logSystem(this.name, `Can NOT sell ${mineral}`);
                }
            }

            if (!transacting && !(global.MAKE_COMPOUNDS || global.ALLOCATE_COMPOUNDS)) {
                transacting = this.fillARoomOrder();
                if (transacting !== true)
                    transacting = false;
            }
        }
    };

    Room.prototype.terminalOrderToSell = function () {

        if (!this.my || !this.terminal || !this.storage)
            return;

        //console.log(`NUKED: ${this.nuked}`);

        let that = this,
            resources = that.memory.resources;

        // _.forEach(object, function (value, key)
        _.forEach(this.storage.store, function (amount, mineral) {

            //global.logSystem(that.name, `${mineral}: ${amount}`);

            if (mineral !== RESOURCE_ENERGY && mineral !== RESOURCE_POWER) {

                let freeSpace = TERMINAL_CAPACITY - global.TERMINAL_FREESPACE - global.TERMINAL_ENERGY + that.terminal.store[RESOURCE_ENERGY] - _.sum(that.terminal.store) - (resources.terminal[0].orders.length > 0 ?
                    _.sum(resources.terminal[0].orders, order => {
                        return order.orderRemaining;
                    }) : 0),
                    offered = that.resourcesOffers[mineral] || 0,
                    inReaction = that.resourcesReactions[mineral] || 0,
                    validRoomMineral = amount >= global.MAX_STORAGE_MINERAL + offered + inReaction + 1550 && mineral === that.memory.mineralType ?
                        amount - global.MAX_STORAGE_MINERAL - offered - inReaction : 0,
                    validNotRoomMineral = amount >= global.MAX_STORAGE_NOT_ROOM_MINERAL + offered + inReaction + 1550 && mineral !== that.memory.mineralType && mineral !== 'G' && mineral.length === 1 ?
                        amount - global.MAX_STORAGE_NOT_ROOM_MINERAL - offered - inReaction : 0,
                    validCompound = function () {
                        // TODO count the number of nuke (damage center: 10M, others: 5M, radius: 5) and if ramparts hits < nuke.damage
                        // for sale
                        if (that.nuked && global.SELL_COMPOUND[mineral] && mineral !== 'XLH2O')
                            return amount;
                        else if (global.SELL_COMPOUND[mineral] && global.SELL_COMPOUND[mineral].sell && amount >= global.SELL_COMPOUND[mineral].maxStorage + offered + 1550
                            && (_.some(global.SELL_COMPOUND[mineral].rooms, room => {
                            return room === that.name;
                            }) || global.SELL_COMPOUND[mineral].rooms.length === 0)
                        )
                            return amount - global.SELL_COMPOUND[mineral].maxStorage - offered;
                        else
                            return 0;
                    },
                    // TODO terminalOrder needed?
                    terminalOrder = resources.terminal[0].orders.length > 0 ? global.sumCompoundType(resources.terminal[0].orders, 'orderRemaining')[mineral] || 0 : 0,
                    transferAmount = validRoomMineral + validNotRoomMineral + validCompound();


                //if (that.name === 'E15S3')
                //    global.logSystem(that.name, `${mineral}: ${amount} validRoomMineral: ${validRoomMineral} validNotRoomMineral: ${validNotRoomMineral} validCompound: ${validCompound()} terminalOrder: ${terminalOrder}`);

                if (transferAmount >= global.MIN_OFFER_AMOUNT) {

                    //console.log(`${that.name} freeTerminalSpace: ${freeSpace} mineral: ${mineral} transferAmount: ${transferAmount}`);

                    if (freeSpace >= transferAmount) {
                        that.placeOrder(that.terminal.id, mineral, transferAmount);
                        global.logSystem(that.name, `${mineral} ${transferAmount}`);

                    } else if (freeSpace >= global.MIN_MINERAL_SELL_AMOUNT) {
                        // try max amount
                        that.placeOrder(that.terminal.id, mineral, freeSpace);
                        global.logSystem(that.name, `${mineral} ${freeSpace} - terminalFull, and transferAmount would be: ${transferAmount}`);
                    }
                }
            }
        });

    };

    Room.prototype.garbageCollectStorageOrders = function () {

        let orders = this.memory.resources.storage[0].orders;

        this.memory.resources.storage[0].orders = _.filter(orders, order =>  {
            return order.orderRemaining > 0;
        });

    };

    Room.prototype.garbageCollectTerminalOrders = function () {

        let orders = this.memory.resources.terminal[0].orders;

        this.memory.resources.terminal[0].orders = _.filter(orders, order =>  {
            return order.orderRemaining > 0;
        });

    };

};
