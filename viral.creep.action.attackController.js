let action = new Creep.Action('attackController');
module.exports = action;
action.isValidAction = function(creep){ return true; };
action.isValidTarget = function(target, creep){ return target && (!target.reservation || !Task.reputation.allyOwner(target.reservation)) && creep.flag; };
action.isAddableAction = function(){ return true; };
action.isAddableTarget = function(target){ return target &&
    ( target instanceof Flag || ( target.structureType === 'controller' && (target.reservation || target.owner)) );
};
action.newTarget = function(creep){
    let validColor = flagEntry => (
        Flag.compare(flagEntry, FLAG_COLOR.invade.attackController)
    );

    let flag;
    if( creep.data.destiny ) flag = Game.flags[creep.data.destiny.targetName];
    if ( !flag ) flag = FlagDir.find(validColor, creep.pos, false, FlagDir.reserveMod, creep.name);

    if( flag ) {
        Population.registerCreepFlag(creep, flag);
    }
    else return null;

    // not there, go to flagged room
    if( !creep.flag.room || creep.flag.pos.roomName != creep.pos.roomName){
        return creep.flag;
    }

    return creep.flag.room.controller;
};

action.step = function(creep){
    if(global.CHATTY) creep.say(this.name, global.SAY_PUBLIC);
    if( creep.target.color ){
        if( creep.flag.pos.roomName == creep.pos.roomName )
            creep.data.targetId = null;
        creep.travelTo(creep.target);
        return;
    }

    let range = creep.pos.getRangeTo(creep.target);
    if( range <= this.targetRange ) {
        let workResult = this.work(creep);
        if( workResult != OK ) {
            creep.handleError({errorCode:workResult,action,target:creep.target,range,creep});
        }
    } else {
        creep.travelTo(creep.target);
    }
};
action.work = function(creep){

    global.logSystem(creep.room.name, `time to die: ${creep.room.controller.upgradeBlocked} > ${creep.ticksToLive}`);

    if (creep.room.controller.upgradeBlocked > creep.ticksToLive)
        creep.suicide();

    let workResult;

    creep.controllerSign();

    global.logSystem(creep.room.name, `${creep.target.owner && !creep.target.my} ${creep.target.reservation && !Task.reputation.allyOwner(creep.target.reservation)}`);

    if( (creep.target.owner && !creep.target.my) ||
        (creep.target.reservation && !Task.reputation.allyOwner(creep.target.reservation))){
        workResult = creep.attackController(creep.target);
    }
    else {
        workResult = creep.claimController(creep.target);
    }

    global.logSystem(creep.room.name, `workResult: ${workResult}`);

    return workResult;
};
