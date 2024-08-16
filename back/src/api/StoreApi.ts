import express from 'express';
import { ConfigMaps } from '../tools/ConfigMaps';
import Semaphore from 'ts-semaphore';
import { validKey } from '../tools/AuthorizationManagement';

export class StoreApi {
  configMaps:ConfigMaps;
  static semaphore:Semaphore = new Semaphore(1);
  static namespace:string;

  public route = express.Router();

  constructor (config:ConfigMaps) {
    this.configMaps=config;

    // A group i simplemented by prepending 'groupname-' (the group name and a dash) to key name

    // get groups
    this.route.route('/:user')
      .all( async (req,res, next) => {
        if (!validKey(req,res)) return;
        next();
      })
      .get(async (req, res) => {
        StoreApi.semaphore.use ( async () => {
          try {
            var data:any= await this.configMaps.read('kwirth.store.'+req.params.user,{});
            if (data===undefined)
              res.status(200).json([]);
            else {
              var allGroupNames=Object.keys(data).map(k => k.substring(0,k.indexOf('-')));
              let uniqueGroups = [...new Set(allGroupNames)];
              res.status(200).json(uniqueGroups);
            }
          }
          catch (err) {
            console.log(err);
            res.status(500).json();
          }
        });
      });

    // get objects in a group
    this.route.route('/:user/:group')
      .all( async (req,res, next) => {
        if (!validKey(req,res)) return;
        next();
      })
      .get(async (req, res) => {
        StoreApi.semaphore.use ( async () => {
          try {
            var data:any= await this.configMaps.read('kwirth.store.'+req.params.user,{});
            if (data===undefined)
              res.status(200).json([]);
            else
              res.status(200).json(Object.keys(data).filter(k => k.startsWith(req.params.group+'-')).map(k => k.substring(k.indexOf('-')+1)));
          }
          catch (err) {
            console.log(err);
            res.status(500).json();
          }
        });
      });

    this.route.route('/:user/:group/:key')
      .all( async (req,res, next) => {
        if (!validKey(req,res)) return;
        next();
      })
      .get( async (req, res) => {
        StoreApi.semaphore.use ( async () => {
          try {
            var data:any= await this.configMaps.read('kwirth.store.'+req.params.user,{});
            if (data[req.params.group+'-'+req.params.key]===undefined)
              res.status(404).json();
            else
              res.status(200).json(data[req.params.group+'-'+req.params.key]);
          }      
          catch (err) {
            console.log(err);
            res.status(500).json();
          }
        });
      })
      .delete( async (req, res) => {
        StoreApi.semaphore.use ( async () => {
          try {
            var data:any= await this.configMaps.read('kwirth.store.'+req.params.user);
            delete data[req.params.group+'-'+req.params.key];
            await this.configMaps.write('kwirth.store.'+req.params.user,data);
            res.status(200).json();
          }      
          catch (err) {
            console.log(err);
            res.status(500).json();
          }
        });
      })
      .post( async (req, res) => {
        StoreApi.semaphore.use ( async () => {
          try {
            var data:any= await this.configMaps.read('kwirth.store.'+req.params.user,{});
            data[req.params.group+'-'+req.params.key]=JSON.stringify(req.body);
            await this.configMaps.write('kwirth.store.'+req.params.user,data);
            res.status(200).json();
          }
          catch (err) {
            res.status(500).json();
            console.log(err);
          }
        });
      });
  }
}
