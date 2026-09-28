"""Revision 6 geometry for the 18Bro Magnet and Moon Boots."""
def make_builders(Shape, matrix, Matrix, math, COLORS):
    def rgb(value):
        return tuple(int(value[i:i+2], 16)/255 for i in (1,3,5))+(1,)
    COLORS.update({'ear_red':rgb('#b52f3e'),'ear_green':rgb('#126148'),'pole_gray':rgb('#b7bcc5')})

    def curved_half(shape,side,radius,center_z,arm_top,body_radius,body_depth,color,y=0,sides=14):
        samples=[]
        if side<0:
            for step in range(5):
                t=step/4
                samples.append((-radius,y,arm_top*(1-t)+center_z*t,body_radius*(.94+.06*t)))
            for step in range(1,13):
                angle=math.pi+math.pi*.5*step/12
                samples.append((radius*math.cos(angle),y,center_z+radius*math.sin(angle),body_radius*(1+.08*step/12)))
        else:
            for step in range(13):
                angle=math.pi*1.5+math.pi*.5*step/12
                samples.append((radius*math.cos(angle),y,center_z+radius*math.sin(angle),body_radius*(1.08-.08*step/12)))
            for step in range(1,5):
                t=step/4
                samples.append((radius,y,center_z*(1-t)+arm_top*t,body_radius*(1-.06*t)))
        vertices,faces=[],[]
        for index,(x,yy,z,section_radius) in enumerate(samples):
            before=samples[max(0,index-1)];after=samples[min(len(samples)-1,index+1)]
            tx,tz=after[0]-before[0],after[2]-before[2];length=math.hypot(tx,tz) or 1
            nx,nz=-tz/length,tx/length
            for ring_step in range(sides):
                angle=2*math.pi*ring_step/sides;planar=section_radius*math.sin(angle)
                vertices.append((x+nx*planar,yy+body_depth*math.cos(angle),z+nz*planar))
        for ring in range(len(samples)-1):
            for step in range(sides):
                a=ring*sides+step;b=ring*sides+(step+1)%sides
                faces.append((a,b,b+sides,a+sides))
        end=0 if side<0 else len(samples)-1;ring=tuple(end*sides+i for i in range(sides))
        faces.append(tuple(reversed(ring)) if side<0 else ring)
        shape.add(vertices,faces,color,True)
        return len(samples)

    def pole_cap(shape,x,y,z0,z1,radius,depth):
        shape.loft([(z0,radius*.92,depth*.92,x,y,.72),(z0+.025,radius,depth,x,y,.72),
                    (z1-.035,radius,depth,x,y,.72),(z1-.012,radius*.94,depth*.94,x,y,.72),
                    (z1,radius*.72,depth*.72,x,y,.72)],'pole_gray',14,True)

    def add_horseshoe(shape,scale=1,y=0):
        radius=.35*scale;center_z=.17*scale;top=.60*scale;body=.142*scale;depth=.105*scale
        count=curved_half(shape,-1,radius,center_z,top,body,depth,'speed_blue',y)
        count+=curved_half(shape,1,radius,center_z,top,body,depth,'coral',y)
        for side in (-1,1):pole_cap(shape,side*radius,y,.535*scale,.795*scale,.145*scale,.108*scale)
        return count

    def add_gold_zap(shape):
        shape.prism([(-.075,.845),(.052,.845),(-.012,.992),(.124,.992),(-.115,1.275),(-.045,1.070),(-.174,1.070)],.080,'gold',y=-.035,bevel=.014)

    def identify(obj,samples,zaps):
        obj['design_revision']=6;obj['magnet_halves']='left_blue_right_red'
        obj['curve_profile']='analytic_tangent_horseshoe';obj['cross_section']='rounded_elliptic'
        obj['curve_samples']=samples;obj['pole_ends']='symmetric_aligned_gray'
        obj['gold_zap_count']=zaps;obj['side_zap_count']=0;return obj

    def build_magnet():
        s=Shape('magnet');samples=add_horseshoe(s);add_gold_zap(s)
        return identify(s.finish(),samples,1)

    def add_moon_sneaker(s,arrow_color,transform=None):
        s.loft([(-.120,.168,.278,0,-.075,.62),(-.095,.181,.294,0,-.078,.66),(-.070,.181,.294,0,-.078,.66)],'rubber',12,False,transform)
        s.loft([(-.071,.176,.287,0,-.078,.64),(-.040,.182,.292,0,-.080,.67),(-.012,.173,.278,0,-.074,.69)],'cream',12,False,transform)
        s.loft([(-.012,.164,.263,0,-.080,.70),(.038,.168,.255,0,-.074,.72),(.100,.158,.214,0,-.040,.76),(.166,.146,.174,0,.006,.79),(.226,.137,.151,0,.030,.80)],'lime',12,True,transform)
        s.ellipsoid((0,-.304,.020),(.145,.034,.052),'mint',12,4,transform)
        s.prism([(-.142,.018),(-.118,.150),(0,.204),(.118,.150),(.142,.018),(.090,.082),(0,.125),(-.090,.082)],.035,'teal',y=-.249,bevel=.008,transform=transform)
        local=transform or Matrix.Identity(4);tongue_tf=local@matrix((0,-.222,.116),(.18,0,0))
        s.rounded_box((0,0,0),(.196,.044,.255),'teal_dark',.020,tongue_tf)
        first_face=len(s.faces)
        s.loft([(.178,.148,.158,0,.030,.78),(.242,.150,.160,0,.030,.78),(.275,.142,.151,0,.030,.78),(.275,.119,.127,0,.030,.78),(.225,.119,.127,0,.030,.78)],'teal',12,True,transform)
        del s.faces[-2:];del s.colors[-2:];del s.smoothing[-2:]
        for i in range(first_face+36,min(first_face+48,len(s.colors))):s.colors[i]=COLORS['teal_dark']
        for i in range(4):
            z=.072+i*.039;y=-.294+i*.030
            s.tube([(-.092,y+.018,z),(0,y,z+.007),(.092,y+.018,z)],.012,'ivory',6,transform)
        s.rounded_box((0,.182,.086),(.285,.050,.220),'teal_dark',.025,transform)
        arrow=[(-.070,-.002),(-.070,.088),(-.125,.088),(0,.222),(.125,.088),(.070,.088),(.070,-.002)]
        outline=[(x*1.18,(z-.105)*1.18+.105) for x,z in arrow]
        s.prism(outline,.040,'cream',y=.218,bevel=.008,transform=transform)
        s.prism(arrow,.032,arrow_color,y=.243,bevel=.007,transform=transform)

    def build_moon():
        s=Shape('moon')
        for side in (-1,1):
            tf=matrix((side*.285,.055 if side<0 else -.055,.015 if side<0 else -.020),(0,side*-.075,side*-.16),(1.42,1.42,1.42))
            add_moon_sneaker(s,'ear_green' if side<0 else 'ear_red',tf)
        obj=s.finish();obj['design_revision']=6;obj['silhouette']='original_mid_top_court_sneakers'
        obj['rear_wing_count']=0;obj['heel_arrows']='left_green_right_red';return obj

    def build_wearable_magnet():
        s=Shape('wearable_magnet');samples=add_horseshoe(s,.64,y=-.080)
        minimum=min(z for x,y,z in s.vertices);s.vertices=[(x,y,z-minimum) for x,y,z in s.vertices]
        obj=s.finish(name='wearable_magnet',normalize=False,origin_contract='paw_grip_origin; glTF_Y_up; front_+Z; units_meters')
        return identify(obj,samples,0)

    def build_wearable_moon(label):
        s=Shape('wearable_moon_'+label);add_moon_sneaker(s,'ear_green' if label=='L' else 'ear_red')
        obj=s.finish(name='wearable_moon_'+label,normalize=False,origin_contract='ankle_pivot_origin; glTF_Y_up; toe_+Z; sole_Y_minus_0_12; units_meters')
        obj['design_revision']=6;obj['shoe_style']='original_mid_top_court_sneaker';obj['rear_wing_count']=0
        obj['heel_arrow']='green' if label=='L' else 'red';return obj
    return build_magnet,build_moon,build_wearable_magnet,build_wearable_moon
