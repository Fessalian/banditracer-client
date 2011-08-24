var gamejs = require('gamejs');
var box2d = require('./box2d');
var utils = require('./utils');
var sounds = require('./sounds');
var buffs = require('./buffs');
var vec=utils.vec;
var arr=utils.arr;

var vectors = gamejs.utils.vectors;
var math = gamejs.utils.math;
radians=math.radians;
degrees=math.degrees;

var animation = require('./animation');

var Projectile=exports.Projectile=function(pars){
    /*
    pars:
    weapon   - weapon object
    position - [x, y]
    angle    - degrees
    width    - meters
    height   - meters
    damage   - damage, points
    */
    this.weapon   = pars.weapon;
    this.speed  = pars.speed;
    this.damage = pars.damage;
    this.position = pars.position;
    this.angle    = pars.angle;
    this.width    = pars.width;
    this.height   = pars.height;
    this.speed    = pars.speed;
    this.damage   = pars.damage;
    this.car      = pars.car;
    this.world=this.car.world;
    this.type='projectile';
    this.spent=false;
    
    //initialize body
    var bdef=new box2d.b2BodyDef();
    bdef.position=vec(this.position);
    bdef.type = box2d.b2Body.b2_dynamicBody;
    bdef.angle=radians(this.angle);
    bdef.linearDamping=0;
    bdef.angularDamping=0;
    bdef.bullet=true;
    bdef.fixedRotation=true;
    this.body=this.world.CreateBody(bdef);
    this.body.SetUserData(this);
    
    //initialize shape
    var fixdef=new box2d.b2FixtureDef;
    fixdef.shape=new box2d.b2PolygonShape();
    fixdef.shape.SetAsBox(this.width/2, this.height/2);
    fixdef.restitution=1; //positively bouncy!
    fixdef.density=0.00001;
    fixdef.friction=0;
   // fixdef.isSensor=true;
    this.body.CreateFixture(fixdef);

    this.getState=function(){
        return {'p':arr(this.body.GetPosition()),
                'a':degrees(this.body.GetAngle()),
                'lv':arr(this.body.GetLinearVelocity())}
    };

    this.interpolate=function(s1, s2, q){
        return {'p':utils.interpolatePoints(s1.p, s2.p, q),
                'a':utils.interpolateInts(s1.a, s2.a, q),
                'lv':s1.lv};
    };

    this.setState=function(state){
        this.body.SetPositionAndAngle(vec(state.p), radians(state.a));
        this.body.SetLinearVelocity(vec(state.lv));
    };
    
    this.getSpeedKMH=function(){
        var velocity=arr(this.body.GetLinearVelocity());
        var len=vectors.len(velocity);
        return (len/1000)*3600;
    };

    this.setSpeed=function(speed){
        if(this.getSpeedKMH()<1) var velocity=arr(this.car.body.GetWorldVector(vec(0, -1)));
        else var velocity=arr(this.body.GetWorldVector(vec(0, -1))); 
        velocity=vectors.multiply(velocity, ((speed*1000)/3600));
        this.body.SetLinearVelocity(vec(velocity));
    };

    this.impact=function(obj, cpoint, direction){
        if((obj.type=='car' || obj.type=='prop') && (!this.spent)){
            this.car.world.event('destroy', this.id);
            if(obj.type=='car'){
                obj.hit(this.damage, this.car);
            }
            if(this.onimpact) this.onimpact(obj);
            this.spent=true;
        }
    };

    this.setSpeed(this.speed);

    this.draw=function(renderer, msDuration){
        console.log('draw not implemented for projectile');
    };

    this.update=function(msDuration){
        //this.setSpeed(this.speed);
    };

    return this;
}

var Mine=exports.Mine=function(pars){
    /*
    pars:
    car   - car object
    position - [x, y]
    */
    this.position=pars.position;
    this.car=pars.car;
    this.width=2;
    this.height=2;
    this.type='mine';
    this.damage=pars.damage;
    this.world=this.car.world;
    
    //initialize body
    var bdef=new box2d.b2BodyDef();
    bdef.position=vec(this.position);
    bdef.angle=0;
    bdef.fixedRotation=true;
    bdef.linearDamping=0;
    bdef.angularDamping=0;
    this.body=this.world.CreateBody(bdef);
    this.body.SetUserData(this);
    
    //initialize shape
    var fixdef=new box2d.b2FixtureDef;
    fixdef.shape=new box2d.b2PolygonShape();
    fixdef.shape.SetAsBox(this.width/2, this.height/2);
    fixdef.isSensor=true;    
    this.body.CreateFixture(fixdef);

    this.getState=function(){
        return null;
    };

    this.setState=function(state){};

    this.impact=function(obj, cpoint, direction){
        if((obj.type=='car')){
            var i, c;
            this.car.world.objects['car'].forEach(function(c){
                if((c==obj) || (vectors.distance(this.position, arr(c.body.GetPosition()))<=8)){
                    c.hit(this.damage, this.car);
                    if(this.onimpact) this.onimpact();
                }
            }, this);
            this.car.world.destroyObj(this.id);
            this.car.world.spawnAnimation('explosion', this.position);
            this.car.world.playSound('explosion.wav', this.position);
        }
    };

    this.draw=function(renderer, msDuration){
        renderer.drawStatic('mine.png', this.position);
    };

    this.destroy=function(){
        this.car.world.event('destroy', this.id);
    };

    return this;
};

var Missile=exports.Missile=function(pars){
    /*
    pars:
    car   - car obj;
    position - [x, y]
    angle    - degrees
    */
    pars.width=0.5;
    pars.height=2.5;
    
    this.tts=50;
    Missile.superConstructor.apply(this, [pars]);
    this.car.world.playSound('missile_launch.wav', this.position);
    this.destroy=function(){
        this.car.world.event('destroy', this.id);
    };

    this.onimpact=function(){
        var pos=arr(this.body.GetPosition())
        this.car.world.spawnAnimation('explosion',pos);
        this.car.world.playSound('explosion.wav', pos);
    };

    this.draw=function(renderer, msDuration){
        if(!this.spent) renderer.drawCar('missile.png', arr(this.body.GetPosition()), degrees(this.body.GetAngle()));
    };

    this.update=function(msDuration){
       // this.setSpeed(this.speed);
        this.tts-=msDuration;
        if(this.tts<0){
            this.car.world.spawnAnimation('smoke',arr(this.body.GetWorldPoint(vec([0, 1.25]))));
            this.tts=50;
        }
    };

    return this;
}
gamejs.utils.objects.extend(Missile, Projectile);


var HomingMissile=exports.HomingMissile=function(pars){
    HomingMissile.superConstructor.apply(this, [pars]);
    
    this.draw=function(renderer, msDuration){
        if(!this.spent) renderer.drawCar('missile_homing.png', arr(this.body.GetPosition()), degrees(this.body.GetAngle()));
    };
    
    this.update=function(msDuration){
        //spawn smoke
        this.tts-=msDuration;
        if(this.tts<0){
            this.car.world.spawnAnimation('smoke',arr(this.body.GetWorldPoint(vec([0, 1.25]))));
            this.tts=50;
        }
        
        //drive the missile towards nearest front facing target
        var target=null;
        var target_distance=1000000;
        this.car.world.objects.car.forEach(function(car){
            var cpos=arr(this.body.GetLocalPoint(car.body.GetPosition()));
            if(cpos[1]<0){
                var distance=gamejs.utils.vectors.distance(arr(this.body.GetPosition()), arr(car.body.GetPosition()));
                if(target_distance>distance){
                    target=car;
                    target_distance=distance;
                    
                }
            }
            return false;
        }, this);
        if(target){
            var cpos=arr(this.body.GetLocalPoint(target.body.GetPosition()));
            var angle=this.body.GetAngle();
            if(cpos[0]<0){
                angle+=gamejs.utils.math.radians((-90/700) * msDuration);
            }else if(cpos[0]>0){
                angle+=gamejs.utils.math.radians((90/700) * msDuration);
            }
            this.body.SetAngle(angle);
            
            this.setSpeed(this.speed);
        }
        
    };
};

gamejs.utils.objects.extend(HomingMissile, Missile);

var Bullet=exports.Bullet=function(pars){
    /*
    pars:
    car   - car obj
    position - [x, y]
    angle    - degrees
    */
    pars.width=0.3;
    pars.height=0.8;
    Bullet.superConstructor.apply(this, [pars]);
    this.color='#FFD800';
    this.car.world.playSound('machinegun_shot.wav', this.position);

    this.onimpact=function(obj){     
        var pos=arr(this.body.GetPosition());
        this.car.world.spawnAnimation('small_explosion', pos);
        if(obj.type=='car'){
            this.car.world.playSound('bullet_impact_metal.wav', pos);
        }else if(obj.type=='prop'){
            this.car.world.playSound('bullet_impact_soft.wav', pos);
        }
    };

    this.draw=function(renderer, msDuration){
        if(!this.spent) renderer.drawCar('bullet.png', arr(this.body.GetPosition()), degrees(this.body.GetAngle()));
    };

    this.destroy=function(){
        this.car.world.destroyObj(this.id);
    };
    return this;
};

gamejs.utils.objects.extend(Bullet, Projectile);

var Weapon=exports.Weapon=function(pars){
    /*
    pars:
    car - car object this weapon belongs to
    missile - missile obj function
    ammo_capacity - int, ammunition count
    fire_rate - ms, duration between firing
    */
    this.car=pars.car;
    this.weapon_id=pars.weapon_id;
    this.ammo_capacity=pars.ammo_capacity+(pars.ammo_upgrades*pars.ammo_upgrade);
    this.fire_rate=pars.fire_rate;
    this.cooldown=0;
    this.ammo=0;
    this.damage=pars.damage+(pars.damage_upgrades*pars.damage_upgrade);
    this.speed=pars.speed;
    this.projectile=pars.projectile;

    this.update=function(msDuration){
        if(this.cooldown>0)this.cooldown-=msDuration;
    };

    this.reload=function(){
        this.ammo=this.ammo_capacity;
    };

    this.getState=function(){
        return {'a':this.ammo}
    };

    this.setState=function(state){
        this.ammo=state.a;
    };
    
    this.fire=function(){
        if(this.ammo&&this.cooldown<=0){
            var pos = this.getFirePos();
            this.car.world.event('create', {'type':'weapon', 'obj_name':this.projectile, 'pars':{'position':pos,
                                                                                                 'damage':this.damage,
                                                                                                 'speed':this.speed,
                                                                                                'angle':this.car.getAngle(),
                                                                                                'car':this.car.id}});
            this.ammo--;
            this.cooldown=this.fire_rate;
            this.ofst_x=this.ofst_x* -1;
        }
    }
    
    this.getFirePos=function(){
        var retv= arr(this.car.body.GetWorldPoint(vec(0, -(this.car.height/2+3))));
        console.log(retv);
        return retv;
    }

    return this;
};

var RepairKit=exports.RepairKit=function(pars){
    Machinegun.superConstructor.apply(this, [pars])
    this.type='repairkit';
    
    this.fire=function(){
        if(this.ammo&&this.cooldown<=0){
            if(this.car.health<this.car.max_health){
                this.car.hit(-this.damage, this.car);
                this.ammo--;
                this.cooldown=this.fire_rate;
            }
        }  
    };
};
gamejs.utils.objects.extend(RepairKit, Weapon);

var Machinegun=exports.Machinegun=function(pars){
    /*
    pars:
    car - car object this weapon belongs to
    */
    this.type='machinegun';
    Machinegun.superConstructor.apply(this, [pars]);
    this.ofst_x=-0.5;

    this.getFirePos=function(){
        this.ofst_x=this.ofst_x* -1;
        return arr(this.car.body.GetWorldPoint(vec(this.ofst_x, -(this.car.height/2+0.8))));    
    };

    return this;
};

gamejs.utils.objects.extend(Machinegun, Weapon);

var ShockwaveGenerator=exports.ShockwaveGenerator=function(pars){
    ShockwaveGenerator.superConstructor.apply(this, [pars]);
    this.type='shockwave';
    this.fire=function(){
        if(this.ammo&&this.cooldown<=0){
            this.car.world.objects.car.forEach(function(car){
                if(car.id!=this.car.id){
                    var tp=arr(this.car.body.GetPosition());
                    var cp=arr(car.body.GetPosition());
                    var d=vectors.distance(tp, cp);
                    if(d<=12){
                        car.hit(this.damage, this.car);
                        new buffs.SlipDebuff(car, 500);
                        //var fvect=vectors.unit(arr(this.car.body.GetLocalPoint(car.body.GetPosition())));
                        var fvect=vectors.unit(vectors.substract(cp, tp));
                        fvect=vectors.multiply(fvect, 400);
                        car.body.ApplyImpulse(vec(fvect), car.body.GetPosition());
                    };
                }
            }, this);
            
            this.car.world.spawnAnimation('shockwave',arr(this.car.body.GetPosition()), this.car);
            this.ammo--;
            this.cooldown=this.fire_rate;
        }  
    };
};

gamejs.utils.objects.extend(ShockwaveGenerator, Weapon);

var MineLauncher=exports.MineLauncher=function(pars){
    /*
    pars:
    car - car object this weapon belongs to
    */
    this.type='minelauncher';

    MineLauncher.superConstructor.apply(this, [pars]);
    
    this.getFirePos=function(){
        return arr(this.car.body.GetWorldPoint(vec(0, (this.car.height/2+3))));  
    };
    return this;
};
gamejs.utils.objects.extend(MineLauncher, Weapon);

var MissileLauncher=exports.MissileLauncher=function(pars){
    this.type='missilelauncher';
    MineLauncher.superConstructor.apply(this, [pars]);
    
    this.getFirePos=function(){
        return arr(this.car.body.GetWorldPoint(vec(0, -(this.car.height/2+3))));    
    };
    
    return this;
};


gamejs.utils.objects.extend(MissileLauncher, Weapon);
